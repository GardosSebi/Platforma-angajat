import { FormEvent, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SsmGateVisitorKind, SsmGateVisitItem } from "@repo/shared-types/ssm";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { MasterDataCreateModal } from "../../master-data/components/MasterDataCreateModal";
import { useEmployeeOptions, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { employmentTypeLabel } from "../../master-data/master-data-shared";
import { ssmApi } from "../api/ssm.api";
import { useAdmissionBlocks, useBriefGateVisit, useCreateGateVisit, useGateVisits, useSignGateVisit } from "../hooks/useSsmGate";

type GateTab = "wizard" | "blocks";
type WizardStep = 1 | 2 | 3 | 4;
type SignTarget = { role: "trainer" } | { role: "attendee"; id: string };

const VISITOR_KINDS: Array<{ value: SsmGateVisitorKind; label: string }> = [
  { value: "VISITOR", label: "Vizitator" },
  { value: "DETACHED", label: "Detașat" },
  { value: "DELEGATED", label: "Delegat" },
  { value: "TEMPORARY", label: "Temporar" },
  { value: "EXTERNAL", label: "Extern" }
];

const KIND_FROM_EMPLOYMENT: Record<string, SsmGateVisitorKind> = {
  DETACHED: "DETACHED",
  DELEGATED: "DELEGATED",
  TEMPORARY: "TEMPORARY",
  EXTERNAL: "EXTERNAL",
  OWN: "VISITOR"
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function visitorKindLabel(kind: SsmGateVisitorKind): string {
  return VISITOR_KINDS.find((item) => item.value === kind)?.label ?? kind;
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

const EMPTY_VISIT_FORM = {
  worksiteId: "",
  companyName: "",
  purpose: "",
  trainerName: "",
  trainerFunction: "",
  location: "",
  briefingTitle: "Instructaj scurt vizitatori / personal extern — reguli de acces și SSM",
  attendees: [] as DraftAttendee[]
};

export function SsmGateManager() {
  const session = useAuthSession();
  const canEdit =
    hasPermission(session?.roles, "ssm:training:edit") || hasPermission(session?.roles, "ssm:training:approve");
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<GateTab>(searchParams.get("tab") === "blocks" ? "blocks" : "wizard");
  const [worksiteFilter, setWorksiteFilter] = useState("");
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [pinnedVisit, setPinnedVisit] = useState<SsmGateVisitItem | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [briefingNotes, setBriefingNotes] = useState("");
  const [trainerSignature, setTrainerSignature] = useState("");
  const [attendeeSignatures, setAttendeeSignatures] = useState<Record<string, string>>({});
  const [form, setForm] = useState(EMPTY_VISIT_FORM);
  const [attendeeOpen, setAttendeeOpen] = useState(false);
  const [attendeeDraft, setAttendeeDraft] = useState<DraftAttendee>(EMPTY_ATTENDEE);
  const [signTarget, setSignTarget] = useState<SignTarget | null>(null);
  const [signDraft, setSignDraft] = useState("");

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
  const activeVisit = useMemo(() => {
    if (!activeVisitId) return null;
    return visits.find((visit) => visit.id === activeVisitId) ?? (pinnedVisit?.id === activeVisitId ? pinnedVisit : null);
  }, [visits, activeVisitId, pinnedVisit]);

  const closeAttendee = useCallback(() => setAttendeeOpen(false), []);
  const closeSign = useCallback(() => setSignTarget(null), []);

  const startNewEntry = () => {
    createVisit.reset();
    briefVisit.reset();
    signVisit.reset();
    setActiveVisitId(null);
    setPinnedVisit(null);
    setStep(1);
    setBriefingNotes("");
    setTrainerSignature("");
    setAttendeeSignatures({});
    setForm(EMPTY_VISIT_FORM);
    setAttendeeOpen(false);
    setSignTarget(null);
  };

  const openVisit = (visit: SsmGateVisitItem) => {
    setActiveVisitId(visit.id);
    setPinnedVisit(visit);
    setBriefingNotes(visit.briefingNotes ?? "");
    setTrainerSignature("");
    setAttendeeSignatures({});
    setStep(visit.status === "REGISTERED" ? 3 : 4);
  };

  const openAttendee = () => {
    setAttendeeDraft({ ...EMPTY_ATTENDEE });
    setAttendeeOpen(true);
  };

  const saveAttendee = (event: FormEvent) => {
    event.preventDefault();
    if (attendeeDraft.fullName.trim().length < 2) return;
    setForm((prev) => ({
      ...prev,
      attendees: [
        ...prev.attendees,
        {
          ...attendeeDraft,
          fullName: attendeeDraft.fullName.trim(),
          company: attendeeDraft.company.trim(),
          idDocument: attendeeDraft.idDocument.trim()
        }
      ]
    }));
    setAttendeeOpen(false);
  };

  const removeAttendee = (index: number) => {
    setForm((prev) => ({ ...prev, attendees: prev.attendees.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const openSignature = (target: SignTarget) => {
    if (target.role === "trainer") {
      setSignDraft(trainerSignature);
    } else {
      setSignDraft(attendeeSignatures[target.id] ?? "");
    }
    setSignTarget(target);
  };

  const saveSignature = (event: FormEvent) => {
    event.preventDefault();
    if (!signTarget || !signDraft.startsWith("data:image")) return;
    if (signTarget.role === "trainer") {
      setTrainerSignature(signDraft);
    } else {
      setAttendeeSignatures((prev) => ({ ...prev, [signTarget.id]: signDraft }));
    }
    setSignTarget(null);
  };

  const onConfirmBriefing = () => {
    const notes = briefingNotes.trim() || undefined;
    if (!activeVisit) {
      const attendees = form.attendees
        .filter((attendee) => attendee.fullName.trim().length >= 2)
        .map((attendee) => ({
          fullName: attendee.fullName.trim(),
          company: attendee.company.trim() || undefined,
          idDocument: attendee.idDocument.trim() || undefined,
          visitorKind: attendee.visitorKind,
          employeeId: attendee.employeeId || undefined
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
            setPinnedVisit(created);
            briefVisit.mutate(
              { visitId: created.id, payload: { briefingNotes: notes } },
              { onSuccess: () => setStep(4) }
            );
          }
        }
      );
      return;
    }
    if (activeVisit.status === "REGISTERED") {
      briefVisit.mutate(
        { visitId: activeVisit.id, payload: { briefingNotes: notes } },
        { onSuccess: () => setStep(4) }
      );
      return;
    }
    setStep(4);
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
        <>
        <div className="ssm-panel-layout ssm-panel-layout--gate">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                {activeVisit ? activeVisit.companyName || activeVisit.briefingTitle : "Intrare nouă"}
              </h4>
              {activeVisit && canEdit ? (
                <button type="button" className="btn-secondary" onClick={startNewEntry}>
                  Intrare nouă
                </button>
              ) : null}
            </div>
            <ol className="ssm-wizard-steps ssm-wizard-steps--4" aria-label="Pași wizard poartă">
              <li className={`ssm-wizard-step ${step === 1 ? "active" : ""} ${step > 1 || activeVisit ? "done" : ""}`}>
                1. Intrare
              </li>
              <li className={`ssm-wizard-step ${step === 2 ? "active" : ""} ${step > 2 || activeVisit ? "done" : ""}`}>
                2. Participanți
              </li>
              <li
                className={`ssm-wizard-step ${step === 3 ? "active" : ""} ${
                  activeVisit && activeVisit.status !== "REGISTERED" ? "done" : ""
                }`}
              >
                3. Instruire
              </li>
              <li className={`ssm-wizard-step ${step === 4 ? "active" : ""} ${activeVisit?.status === "SIGNED" ? "done" : ""}`}>
                4. Semnături
              </li>
            </ol>

            {!canEdit ? (
              <p className="field-hint">Ai acces doar în citire. Crearea vizitelor necesită drept de editare instruiri.</p>
            ) : null}

            {step === 1 && !activeVisit && canEdit ? (
              <div className="form-stack">
                <FieldSelect
                  id="gate-worksite"
                  label="Punct de lucru"
                  value={form.worksiteId}
                  onChange={(worksiteId) => setForm((prev) => ({ ...prev, worksiteId }))}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="gate-purpose">Scopul vizitei</label>
                  <input
                    id="gate-purpose"
                    value={form.purpose}
                    onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="gate-location">Locație / poartă</label>
                  <input
                    id="gate-location"
                    value={form.location}
                    onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  />
                </div>
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-primary" onClick={() => setStep(2)}>
                    Continuă la participanți
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 && !activeVisit && canEdit ? (
              <div className="form-stack">
                <div className="ssm-history-list">
                  {form.attendees.map((attendee, index) => (
                    <div key={`${attendee.employeeId}-${index}`} className="ssm-history-item">
                      <div>
                        <strong>{attendee.fullName}</strong>
                        <div className="field-hint">
                          {visitorKindLabel(attendee.visitorKind)}
                          {attendee.idDocument ? ` · ${attendee.idDocument}` : ""}
                        </div>
                      </div>
                      <button type="button" className="btn-text" onClick={() => removeAttendee(index)}>
                        Scoate
                      </button>
                    </div>
                  ))}
                  {!form.attendees.length ? <p className="field-hint">Niciun participant adăugat.</p> : null}
                </div>
                <button type="button" className="btn-secondary" onClick={openAttendee}>
                  Adaugă participant
                </button>
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                    Înapoi
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!form.attendees.some((attendee) => attendee.fullName.trim().length >= 2)}
                    onClick={() => setStep(3)}
                  >
                    Continuă la instruire
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 && canEdit ? (
              <div className="form-stack">
                {activeVisit ? (
                  <p className="field-hint">
                    {activeVisit.briefingTitle} · {activeVisit.attendees.length} participanți ·{" "}
                    {visitStatusLabel(activeVisit.status)}
                  </p>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="gate-title">Tematică instruire scurtă</label>
                      <input
                        id="gate-title"
                        required
                        value={form.briefingTitle}
                        onChange={(event) => setForm((prev) => ({ ...prev, briefingTitle: event.target.value }))}
                      />
                    </div>
                    <div className="ssm-panel-fields-row">
                      <div className="field">
                        <label htmlFor="gate-trainer">Instructor</label>
                        <input
                          id="gate-trainer"
                          value={form.trainerName}
                          onChange={(event) => setForm((prev) => ({ ...prev, trainerName: event.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="gate-function">Funcție instructor</label>
                        <input
                          id="gate-function"
                          value={form.trainerFunction}
                          onChange={(event) => setForm((prev) => ({ ...prev, trainerFunction: event.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="field">
                  <label htmlFor="gate-notes">Note instruire (riscuri, traseu, EIP vizitator)</label>
                  <textarea
                    id="gate-notes"
                    rows={4}
                    value={briefingNotes}
                    onChange={(event) => setBriefingNotes(event.target.value)}
                  />
                </div>
                <div className="ssm-wizard-actions">
                  {!activeVisit ? (
                    <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                      Înapoi
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={createVisit.isPending || briefVisit.isPending || (!activeVisit && !form.briefingTitle.trim())}
                    onClick={onConfirmBriefing}
                  >
                    {createVisit.isPending || briefVisit.isPending ? "Se salvează…" : "Confirmă instruirea"}
                  </button>
                </div>
                {createVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(createVisit.error)}</p>
                ) : null}
                {briefVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(briefVisit.error)}</p>
                ) : null}
              </div>
            ) : null}

            {step === 4 && activeVisit ? (
              <div className="form-stack">
                <p className="field-hint">
                  Semnează pe rând instructorul și fiecare participant. Fișa colectivă se închide după toate semnăturile
                  necesare.
                </p>
                <div className="ssm-history-list">
                  <div className="ssm-history-item">
                    <div>
                      <strong>{activeVisit.trainerName || form.trainerName || "Instructor"}</strong>
                      <div className="field-hint">
                        Instructor
                        {trainerSignature.startsWith("data:image") || activeVisit.status === "SIGNED"
                          ? " · semnat"
                          : " · nesemnat"}
                      </div>
                    </div>
                    {canEdit && activeVisit.status !== "SIGNED" ? (
                      <button type="button" className="btn-text" onClick={() => openSignature({ role: "trainer" })}>
                        Semnează
                      </button>
                    ) : null}
                  </div>
                  {activeVisit.attendees.map((attendee) => {
                    const signed =
                      attendee.hasSignature || (attendeeSignatures[attendee.id]?.startsWith("data:image") ?? false);
                    return (
                      <div key={attendee.id} className="ssm-history-item">
                        <div>
                          <strong>{attendee.fullName}</strong>
                          <div className="field-hint">
                            {visitorKindLabel(attendee.visitorKind)}
                            {signed ? " · semnat" : " · nesemnat"}
                          </div>
                        </div>
                        {canEdit && activeVisit.status !== "SIGNED" ? (
                          <button
                            type="button"
                            className="btn-text"
                            onClick={() => openSignature({ role: "attendee", id: attendee.id })}
                          >
                            Semnează
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="ssm-wizard-actions">
                  {canEdit && activeVisit.status !== "SIGNED" ? (
                    <button type="button" className="btn-primary" disabled={signVisit.isPending} onClick={onSign}>
                      {signVisit.isPending ? "Se semnează…" : "Închide fișa colectivă"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      void downloadWithAuth(ssmApi.getGateAnexa12Url(activeVisit.id), `anexa-12-${activeVisit.id}.pdf`)
                    }
                  >
                    Descarcă Anexa 12
                  </button>
                </div>
                {signVisit.isError ? (
                  <p className="feedback error">{mutationErrorMessage(signVisit.error)}</p>
                ) : null}
                {signVisit.isSuccess || activeVisit.status === "SIGNED" ? (
                  <p className="feedback success">Fișa colectivă a fost semnată.</p>
                ) : null}
              </div>
            ) : null}

            {step === 1 && !canEdit ? (
              <p className="field-hint">Alege o vizită din listă. Crearea unei intrări noi cere drept de editare.</p>
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
                    onClick={() => openVisit(visit)}
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

        {attendeeOpen ? (
          <MasterDataCreateModal title="Participant nou" titleId="gate-attendee-modal" onClose={closeAttendee}>
            <form className="form-stack" onSubmit={saveAttendee}>
              {nonOwnEmployees.length ? (
                <FieldSelect
                  id="gate-pick-employee"
                  label="Din evidență"
                  value={attendeeDraft.employeeId}
                  onChange={(employeeId) => {
                    const employee = nonOwnEmployees.find((item) => item.id === employeeId);
                    if (!employee) {
                      setAttendeeDraft((prev) => ({ ...prev, employeeId: "" }));
                      return;
                    }
                    setAttendeeDraft({
                      fullName: employee.fullName,
                      company: "",
                      idDocument: "",
                      visitorKind: KIND_FROM_EMPLOYMENT[employee.employmentType ?? ""] ?? "EXTERNAL",
                      employeeId: employee.id
                    });
                  }}
                  allowEmpty
                  emptyLabel="Completează manual"
                  options={mapToOptions(
                    nonOwnEmployees,
                    (item) => item.id,
                    (item) => `${item.fullName} · ${employmentTypeLabel(item.employmentType)}`
                  )}
                />
              ) : null}
              <div className="field">
                <label htmlFor="gate-attendee-name">Nume</label>
                <input
                  id="gate-attendee-name"
                  required
                  value={attendeeDraft.fullName}
                  onChange={(event) => setAttendeeDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>
              <FieldSelect
                id="gate-attendee-kind"
                label="Tip"
                value={attendeeDraft.visitorKind}
                onChange={(visitorKind) =>
                  setAttendeeDraft((prev) => ({ ...prev, visitorKind: visitorKind as SsmGateVisitorKind }))
                }
                options={VISITOR_KINDS}
              />
              <div className="field">
                <label htmlFor="gate-attendee-doc">Act de identitate</label>
                <input
                  id="gate-attendee-doc"
                  value={attendeeDraft.idDocument}
                  onChange={(event) => setAttendeeDraft((prev) => ({ ...prev, idDocument: event.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary">
                Adaugă în listă
              </button>
            </form>
          </MasterDataCreateModal>
        ) : null}

        {signTarget && activeVisit ? (
          <MasterDataCreateModal
            title={
              signTarget.role === "trainer"
                ? "Semnătură instructor"
                : `Semnătură ${activeVisit.attendees.find((attendee) => attendee.id === signTarget.id)?.fullName ?? ""}`
            }
            titleId="gate-sign-modal"
            onClose={closeSign}
          >
            <form className="form-stack" onSubmit={saveSignature}>
              <SignatureCanvas label="Semnătură" value={signDraft} onChange={setSignDraft} />
              <button type="submit" className="btn-primary" disabled={!signDraft.startsWith("data:image")}>
                Salvează semnătura
              </button>
            </form>
          </MasterDataCreateModal>
        ) : null}
        </>
      ) : null}

      {tab === "blocks" ? (
        <div className="card ssm-doc-card admission-block-print">
          <h4 className="card-title">Nu intra la lucru</h4>
          <p className="field-hint">
            Listă operațională pentru șefi de tură și poartă: instruiri blocate sau aptitudine medicală inapt.
          </p>
          <div className="form-actions" style={{ marginBottom: "0.85rem" }}>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Tipărește lista
            </button>
          </div>
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
                      {[item.jobPositionName, item.departmentName, item.worksiteName, employmentTypeLabel(item.employmentType)]
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
