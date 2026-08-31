import { FormEvent, useMemo, useState } from "react";
import type { SsmGateVisitorKind, SsmGateVisitItem } from "@repo/shared-types/ssm";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { useEmployeeOptions, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import { useAdmissionBlocks, useBriefGateVisit, useCreateGateVisit, useGateVisits, useSignGateVisit } from "../hooks/useSsmGate";

type GateTab = "wizard" | "blocks";
type WizardStep = 1 | 2 | 3;

const VISITOR_KINDS: Array<{ value: SsmGateVisitorKind; label: string }> = [
  { value: "VISITOR", label: "Vizitator" },
  { value: "DETACHED", label: "Detașat" },
  { value: "TEMPORARY", label: "Temporar" },
  { value: "EXTERNAL", label: "Extern" }
];

const KIND_FROM_EMPLOYMENT: Record<string, SsmGateVisitorKind> = {
  DETACHED: "DETACHED",
  TEMPORARY: "TEMPORARY",
  EXTERNAL: "EXTERNAL",
  OWN: "VISITOR"
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function visitStatusLabel(status: SsmGateVisitItem["status"]): string {
  switch (status) {
    case "REGISTERED":
      return "Înregistrat la poartă";
    case "BRIEFING":
      return "Instruire scurtă";
    case "SIGNED":
      return "Fișă semnată";
    case "CANCELLED":
      return "Anulat";
    default:
      return status;
  }
}

type DraftAttendee = {
  fullName: string;
  company: string;
  idDocument: string;
  visitorKind: SsmGateVisitorKind;
  employeeId: string;
};

const EMPTY_ATTENDEE: DraftAttendee = {
  fullName: "",
  company: "",
  idDocument: "",
  visitorKind: "VISITOR",
  employeeId: ""
};

export function SsmGateManager() {
  const session = useAuthSession();
  const canEdit = hasPermission(session?.roles, "ssm:training:edit");
  const [tab, setTab] = useState<GateTab>("wizard");
  const [worksiteFilter, setWorksiteFilter] = useState("");
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [briefingNotes, setBriefingNotes] = useState("");
  const [trainerSignature, setTrainerSignature] = useState("");
  const [attendeeSignatures, setAttendeeSignatures] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    worksiteId: "",
    companyName: "",
    purpose: "",
    trainerName: "",
    trainerFunction: "",
    location: "",
    briefingTitle: "Instructaj scurt vizitatori / personal extern — reguli de acces și SSM",
    attendees: [{ ...EMPTY_ATTENDEE }]
  });

  const worksitesQuery = useWorksitesLookup();
  const employeesQuery = useEmployeeOptions();
  const visitsQuery = useGateVisits(worksiteFilter || undefined);
  const blocksQuery = useAdmissionBlocks(worksiteFilter || undefined);
  const createVisit = useCreateGateVisit();
  const briefVisit = useBriefGateVisit();
  const signVisit = useSignGateVisit();

  const worksites = worksitesQuery.data?.items ?? [];
  const nonOwnEmployees = (employeesQuery.data?.items ?? []).filter(
    (emp) => emp.employmentType && emp.employmentType !== "OWN"
  );
  const visits = visitsQuery.data?.items ?? [];
  const activeVisit = useMemo(
    () => visits.find((v) => v.id === activeVisitId) ?? visits[0] ?? null,
    [visits, activeVisitId]
  );

  const addAttendee = () => setForm((p) => ({ ...p, attendees: [...p.attendees, { ...EMPTY_ATTENDEE }] }));

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    const attendees = form.attendees
      .filter((a) => a.fullName.trim().length >= 2)
      .map((a) => ({
        fullName: a.fullName.trim(),
        company: a.company.trim() || undefined,
        idDocument: a.idDocument.trim() || undefined,
        visitorKind: a.visitorKind,
        employeeId: a.employeeId || undefined
      }));
    createVisit.mutate(
      {
        worksiteId: form.worksiteId || undefined,
        companyName: form.companyName.trim() || undefined,
        purpose: form.purpose.trim() || undefined,
        trainerName: form.trainerName.trim() || undefined,
        trainerFunction: form.trainerFunction.trim() || undefined,
        location: form.location.trim() || undefined,
        briefingTitle: form.briefingTitle.trim(),
        attendees
      },
      {
        onSuccess: (created) => {
          setActiveVisitId(created.id);
          setStep(2);
        }
      }
    );
  };

  const onBrief = () => {
    if (!activeVisit) return;
    briefVisit.mutate(
      { visitId: activeVisit.id, payload: { briefingNotes: briefingNotes.trim() || undefined } },
      { onSuccess: () => setStep(3) }
    );
  };

  const onSign = () => {
    if (!activeVisit) return;
    const signatures = activeVisit.attendees
      .filter((a) => attendeeSignatures[a.id]?.startsWith("data:image"))
      .map((a) => ({ attendeeId: a.id, signatureData: attendeeSignatures[a.id] }));
    signVisit.mutate({
      visitId: activeVisit.id,
      payload: {
        trainerSignature: trainerSignature.startsWith("data:image") ? trainerSignature : undefined,
        signatures
      }
    });
  };

  return (
    <section className="ssm-eip-panel" aria-label="Poartă, vizitatori și admitere">
      <div className="ssm-panel-tabs ssm-panel-tabs--2" role="tablist" aria-label="Secțiuni poartă">
        <button
          type="button"
          className={`ssm-panel-tab ${tab === "wizard" ? "active" : ""}`}
          onClick={() => setTab("wizard")}
        >
          <strong>Wizard poartă</strong>
          <span>Intrare → instruire → Anexa 12</span>
        </button>
        <button
          type="button"
          className={`ssm-panel-tab ${tab === "blocks" ? "active" : ""}`}
          onClick={() => setTab("blocks")}
        >
          <strong>Nu intra la lucru</strong>
          <span>Listă operațională șefi tură / poartă</span>
        </button>
      </div>

      <div className="field" style={{ maxWidth: "20rem", marginBottom: "1rem" }}>
        <FieldSelect
          id="gate-worksite-filter"
          label="Punct de lucru"
          value={worksiteFilter}
          onChange={setWorksiteFilter}
          allowEmpty
          emptyLabel="Toate punctele de lucru"
          options={mapToOptions(
            worksites,
            (item) => item.id,
            (item) => `${item.code} — ${item.name}`
          )}
        />
      </div>

      {tab === "wizard" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <ol className="ssm-wizard-steps" aria-label="Pași wizard poartă">
              <li className={`ssm-wizard-step ${step === 1 ? "active" : ""} ${activeVisit ? "done" : ""}`}>
                1. Intrare pe poartă
              </li>
              <li className={`ssm-wizard-step ${step === 2 ? "active" : ""} ${activeVisit?.status !== "REGISTERED" ? "done" : ""}`}>
                2. Instruire scurtă
              </li>
              <li className={`ssm-wizard-step ${step === 3 ? "active" : ""} ${activeVisit?.status === "SIGNED" ? "done" : ""}`}>
                3. Fișă colectivă semnată
              </li>
            </ol>

            {!canEdit ? (
              <p className="field-hint">Ai acces doar în citire. Crearea vizitelor necesită drept de editare instruiri.</p>
            ) : null}

            {step === 1 && canEdit ? (
              <form className="form-stack" onSubmit={onCreate}>
                <FieldSelect
                  id="gate-worksite"
                  label="Punct de lucru"
                  value={form.worksiteId}
                  onChange={(worksiteId) => setForm((p) => ({ ...p, worksiteId }))}
                  allowEmpty
                  emptyLabel="Selectează punct de lucru"
                  options={mapToOptions(
                    worksites,
                    (item) => item.id,
                    (item) => `${item.code} — ${item.name}`
                  )}
                />
                <div className="field">
                  <label htmlFor="gate-company">Firmă / proveniență</label>
                  <input
                    id="gate-company"
                    value={form.companyName}
                    onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="gate-purpose">Scopul vizitei</label>
                  <input
                    id="gate-purpose"
                    value={form.purpose}
                    onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="gate-title">Tematică instruire scurtă</label>
                  <input
                    id="gate-title"
                    required
                    value={form.briefingTitle}
                    onChange={(e) => setForm((p) => ({ ...p, briefingTitle: e.target.value }))}
                  />
                </div>
                <div className="ssm-panel-fields-row">
                  <div className="field">
                    <label htmlFor="gate-trainer">Instructor</label>
                    <input
                      id="gate-trainer"
                      value={form.trainerName}
                      onChange={(e) => setForm((p) => ({ ...p, trainerName: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="gate-function">Funcție instructor</label>
                    <input
                      id="gate-function"
                      value={form.trainerFunction}
                      onChange={(e) => setForm((p) => ({ ...p, trainerFunction: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="gate-location">Locație / poartă</label>
                  <input
                    id="gate-location"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>

                <h4 className="ssm-subtitle">Participanți</h4>
                {nonOwnEmployees.length ? (
                  <FieldSelect
                    id="gate-pick-employee"
                    label="Adaugă din evidență (detașați / temporari / externi)"
                    value=""
                    onChange={(employeeId) => {
                      const emp = nonOwnEmployees.find((item) => item.id === employeeId);
                      if (!emp) return;
                      setForm((p) => ({
                        ...p,
                        attendees: [
                          ...p.attendees.filter((a) => a.fullName.trim()),
                          {
                            fullName: emp.fullName,
                            company: "",
                            idDocument: "",
                            visitorKind: KIND_FROM_EMPLOYMENT[emp.employmentType ?? ""] ?? "EXTERNAL",
                            employeeId: emp.id
                          }
                        ]
                      }));
                    }}
                    allowEmpty
                    emptyLabel="Selectează persoană din evidență"
                    options={mapToOptions(
                      nonOwnEmployees,
                      (item) => item.id,
                      (item) => `${item.fullName} · ${item.employmentType}`
                    )}
                  />
                ) : null}

                {form.attendees.map((attendee, index) => (
                  <div key={`${attendee.employeeId}-${index}`} className="ssm-gate-attendee-row">
                    <div className="field">
                      <label>Nume</label>
                      <input
                        required={index === 0}
                        value={attendee.fullName}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            attendees: p.attendees.map((a, i) =>
                              i === index ? { ...a, fullName: e.target.value } : a
                            )
                          }))
                        }
                      />
                    </div>
                    <FieldSelect
                      id={`gate-kind-${index}`}
                      label="Tip"
                      value={attendee.visitorKind}
                      onChange={(visitorKind) =>
                        setForm((p) => ({
                          ...p,
                          attendees: p.attendees.map((a, i) =>
                            i === index ? { ...a, visitorKind: visitorKind as SsmGateVisitorKind } : a
                          )
                        }))
                      }
                      options={VISITOR_KINDS}
                    />
                    <div className="field">
                      <label>Act identitate</label>
                      <input
                        value={attendee.idDocument}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            attendees: p.attendees.map((a, i) =>
                              i === index ? { ...a, idDocument: e.target.value } : a
                            )
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addAttendee}>
                  Adaugă participant
                </button>
                <button className="btn-primary" type="submit" disabled={createVisit.isPending}>
                  {createVisit.isPending ? "Se înregistrează…" : "Înregistrează la poartă"}
                </button>
                {createVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(createVisit.error)}</p>
                ) : null}
              </form>
            ) : null}

            {step === 2 && activeVisit ? (
              <div className="form-stack">
                <p>
                  Tematică: <strong>{activeVisit.briefingTitle}</strong>
                </p>
                <p className="field-hint">
                  {activeVisit.attendees.length} participanți · {visitStatusLabel(activeVisit.status)}
                </p>
                <div className="field">
                  <label htmlFor="gate-notes">Note instruire scurtă (riscuri, traseu, EIP vizitator)</label>
                  <textarea
                    id="gate-notes"
                    rows={4}
                    value={briefingNotes}
                    onChange={(e) => setBriefingNotes(e.target.value)}
                  />
                </div>
                <ul className="employee-dossier-list">
                  {activeVisit.attendees.map((a) => (
                    <li key={a.id}>
                      <strong>{a.fullName}</strong>
                      <span>
                        {a.visitorKind}
                        {a.trainingAcknowledgedAt ? " · a luat la cunoștință" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {canEdit ? (
                  <button type="button" className="btn-primary" disabled={briefVisit.isPending} onClick={onBrief}>
                    {briefVisit.isPending ? "Se salvează…" : "Confirmă instruirea scurtă"}
                  </button>
                ) : null}
                {briefVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(briefVisit.error)}</p>
                ) : null}
              </div>
            ) : null}

            {step === 3 && activeVisit ? (
              <div className="form-stack">
                <p className="field-hint">Semnături olografe pentru fișa colectivă Anexa 12.</p>
                {canEdit ? (
                  <>
                    <SignatureCanvas
                      label="Semnătură instructor"
                      value={trainerSignature}
                      onChange={setTrainerSignature}
                    />
                    {activeVisit.attendees.map((a) => (
                      <SignatureCanvas
                        key={a.id}
                        label={`Semnătură ${a.fullName}`}
                        value={attendeeSignatures[a.id] ?? ""}
                        onChange={(dataUrl) => setAttendeeSignatures((p) => ({ ...p, [a.id]: dataUrl }))}
                      />
                    ))}
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={signVisit.isPending}
                      onClick={onSign}
                    >
                      {signVisit.isPending ? "Se semnează…" : "Semnează fișa colectivă"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    void downloadWithAuth(ssmApi.getGateAnexa12Url(activeVisit.id), `anexa-12-${activeVisit.id}.pdf`)
                  }
                >
                  Descarcă Anexa 12 PDF
                </button>
                {signVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(signVisit.error)}</p>
                ) : null}
                {signVisit.isSuccess ? (
                  <p className="feedback success">Fișa colectivă a fost semnată.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Vizite recente</h4>
            {visitsQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
            {!visits.length && !visitsQuery.isLoading ? (
              <p className="field-hint">Nicio vizită înregistrată.</p>
            ) : (
              <div className="ssm-history-list">
                {visits.map((visit) => (
                  <button
                    key={visit.id}
                    type="button"
                    className={`ssm-history-item ssm-gate-visit-pick ${activeVisit?.id === visit.id ? "active" : ""}`}
                    onClick={() => {
                      setActiveVisitId(visit.id);
                      setStep(visit.status === "SIGNED" ? 3 : 2);
                    }}
                  >
                    <div>
                      <strong>{visit.companyName || visit.briefingTitle}</strong>
                      <div className="field-hint">
                        {new Date(visit.visitDate).toLocaleString("ro-RO")} · {visit.attendees.length} persoane ·{" "}
                        {visit.worksiteName ?? "fără punct"}
                      </div>
                    </div>
                    <span className={visit.status === "SIGNED" ? "badge-good" : "badge-bad"}>
                      {visitStatusLabel(visit.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "blocks" ? (
        <div className="card ssm-doc-card">
          <h4 className="card-title">Nu intra la lucru</h4>
          <p className="field-hint">
            Listă operațională pentru șefi de tură și poartă: instruiri blocate sau aptitudine medicală inapt.
          </p>
          {blocksQuery.isLoading ? <p>Se încarcă…</p> : null}
          {(blocksQuery.data?.items ?? []).length === 0 && !blocksQuery.isLoading ? (
            <p className="feedback success">Nicio persoană blocată la admitere pe filtrul curent.</p>
          ) : (
            <ul className="admission-block-list">
              {(blocksQuery.data?.items ?? []).map((item) => (
                <li key={item.employeeId}>
                  <div>
                    <strong>{item.fullName}</strong>
                    <span className="field-hint">
                      {[item.jobPositionName, item.departmentName, item.worksiteName, item.employmentType]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="admission-block-reasons">
                    {item.reasons.includes("TRAINING") ? (
                      <span className="badge-bad">Instruire ({item.trainingOverdueCount})</span>
                    ) : null}
                    {item.reasons.includes("MEDICAL") ? (
                      <span className="badge-bad">Medical {item.lastMedicalResult ?? ""}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
