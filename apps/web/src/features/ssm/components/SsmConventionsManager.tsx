import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  SSM_CONVENTION_STATUS_LABELS,
  SSM_CONVENTION_STATUSES,
  type CreateSsmConventionPartyRequest,
  type SsmConventionClauses,
  type SsmConventionItem,
  type SsmConventionStatus
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import {
  useActivateConvention,
  useAddConventionParty,
  useConventions,
  useCreateConvention,
  useDeleteConvention,
  useRemoveConventionParty,
  useSignConventionParty,
  useTerminateConvention,
  useUpdateConvention
} from "../hooks/useSsmConventions";

type ClauseKey = keyof SsmConventionClauses;

const CLAUSES: Array<{ key: ClauseKey; label: string; placeholder: string }> = [
  {
    key: "activityDescription",
    label: "Obiectul convenției / activități desfășurate",
    placeholder: "ex. lucrări de montaj structură metalică în hala 2, descărcare marfă la rampele 4–6"
  },
  {
    key: "sharedRisks",
    label: "Riscuri comune și riscuri induse între firme",
    placeholder: "ex. circulație stivuitoare, lucru la înălțime deasupra zonelor de trecere, sudură lângă materiale combustibile"
  },
  {
    key: "preventionMeasures",
    label: "Măsuri de prevenire și protecție convenite",
    placeholder: "ex. delimitare zonă de lucru, permis de lucru cu foc, interzicerea accesului în timpul ridicărilor"
  },
  {
    key: "trainingArrangements",
    label: "Instruire, informare și acces",
    placeholder: "ex. instruire la poartă pentru fiecare lucrător terț, lista nominală transmisă zilnic"
  },
  {
    key: "eipArrangements",
    label: "Echipament individual de protecție",
    placeholder: "ex. fiecare angajator asigură EIP propriilor lucrători: cască, vestă, bocanci S3, ham pentru lucru la înălțime"
  },
  {
    key: "emergencyArrangements",
    label: "Prim ajutor, PSI și evacuare",
    placeholder: "ex. trusa de prim ajutor și stingătoarele beneficiarului, punct de adunare P1, coordonator evacuare"
  }
];

const EMPTY_PARTY: CreateSsmConventionPartyRequest = {
  companyName: "",
  cui: "",
  representativeName: "",
  representativeFunction: "",
  ssmContactName: "",
  ssmContactPhone: "",
  ssmContactEmail: "",
  obligations: ""
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ro-RO");
}

function statusChip(status: SsmConventionStatus): string {
  if (status === "ACTIVE") return "ssm-chip good";
  if (status === "DRAFT") return "ssm-chip warn";
  return "ssm-chip";
}

function trimmedParty(party: CreateSsmConventionPartyRequest): CreateSsmConventionPartyRequest {
  return {
    companyName: party.companyName.trim(),
    representativeName: party.representativeName.trim(),
    cui: party.cui?.trim() || undefined,
    representativeFunction: party.representativeFunction?.trim() || undefined,
    ssmContactName: party.ssmContactName?.trim() || undefined,
    ssmContactPhone: party.ssmContactPhone?.trim() || undefined,
    ssmContactEmail: party.ssmContactEmail?.trim() || undefined,
    workersCount: party.workersCount,
    obligations: party.obligations?.trim() || undefined
  };
}

type DraftForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  coordinatorName: string;
  coordinatorFunction: string;
  coordinatorEmail: string;
  notes: string;
} & Record<ClauseKey, string>;

function draftFrom(item: SsmConventionItem): DraftForm {
  return {
    title: item.title,
    startsAt: item.startsAt.slice(0, 10),
    endsAt: item.endsAt?.slice(0, 10) ?? "",
    coordinatorName: item.coordinatorName ?? "",
    coordinatorFunction: item.coordinatorFunction ?? "",
    coordinatorEmail: item.coordinatorEmail ?? "",
    notes: item.notes ?? "",
    activityDescription: item.activityDescription ?? "",
    sharedRisks: item.sharedRisks ?? "",
    preventionMeasures: item.preventionMeasures ?? "",
    emergencyArrangements: item.emergencyArrangements ?? "",
    trainingArrangements: item.trainingArrangements ?? "",
    eipArrangements: item.eipArrangements ?? ""
  };
}

export function SsmConventionsManager() {
  const session = useAuthSession();
  const canEdit = hasPermission(session?.roles, "ssm:documents:edit");
  const [filters, setFilters] = useState<{ worksiteId: string; status: SsmConventionStatus | "" }>({
    worksiteId: "",
    status: ""
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [createForm, setCreateForm] = useState({
    worksiteId: "",
    title: "Convenție SSM pentru lucrări pe locul de muncă comun",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
    firstParty: { ...EMPTY_PARTY }
  });
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [partyForm, setPartyForm] = useState<CreateSsmConventionPartyRequest>({ ...EMPTY_PARTY });
  const [signingPartyId, setSigningPartyId] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [terminateReason, setTerminateReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const worksites = useWorksitesLookup();
  const listQuery = useConventions({
    worksiteId: filters.worksiteId || undefined,
    status: filters.status || undefined
  });
  const items = listQuery.data?.items ?? [];
  const uncovered = listQuery.data?.uncoveredCompanies ?? [];
  const selected = items.find((item) => item.id === selectedId);

  const createConvention = useCreateConvention();
  const updateConvention = useUpdateConvention();
  const deleteConvention = useDeleteConvention();
  const addParty = useAddConventionParty();
  const removeParty = useRemoveConventionParty();
  const signParty = useSignConventionParty();
  const activate = useActivateConvention();
  const terminate = useTerminateConvention();

  const worksiteOptions = useMemo(
    () => mapToOptions(worksites.data?.items ?? [], (site) => site.id, (site) => `${site.code} — ${site.name}`),
    [worksites.data?.items]
  );

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    setDraft(selected ? draftFrom(selected) : null);
    setSigningPartyId(null);
    setSignature("");
  }, [selected?.id, selected?.status, selected?.parties.length]);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    const party = createForm.firstParty.companyName.trim() ? [trimmedParty(createForm.firstParty)] : [];
    createConvention.mutate(
      {
        worksiteId: createForm.worksiteId,
        title: createForm.title.trim(),
        startsAt: createForm.startsAt,
        endsAt: createForm.endsAt || undefined,
        parties: party
      },
      {
        onSuccess: (created) => {
          setSelectedId(created.id);
          setCreateForm((prev) => ({ ...prev, firstParty: { ...EMPTY_PARTY } }));
        }
      }
    );
  };

  const onSaveDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !draft) return;
    updateConvention.mutate({
      conventionId: selected.id,
      payload: {
        title: draft.title.trim(),
        startsAt: draft.startsAt,
        endsAt: draft.endsAt || null,
        coordinatorName: draft.coordinatorName,
        coordinatorFunction: draft.coordinatorFunction,
        coordinatorEmail: draft.coordinatorEmail.trim() || undefined,
        notes: draft.notes,
        activityDescription: draft.activityDescription,
        sharedRisks: draft.sharedRisks,
        preventionMeasures: draft.preventionMeasures,
        emergencyArrangements: draft.emergencyArrangements,
        trainingArrangements: draft.trainingArrangements,
        eipArrangements: draft.eipArrangements
      }
    });
  };

  const download = (conventionId: string, fileName: string) => {
    setActionError(null);
    void downloadWithAuth(ssmApi.getConventionPdfUrl(conventionId), fileName).catch((error: unknown) =>
      setActionError(errorMessage(error))
    );
  };

  const isDraft = selected?.status === "DRAFT";
  const editable = canEdit && isDraft;

  return (
    <div className="ssm-panel-layout">
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-card-header">
          <h4 className="card-title">Convenții SSM multi-angajator</h4>
        </div>
        <p className="field-hint">
          Pentru șantiere și depozite unde lucrează simultan personal propriu și al firmelor terțe: fiecare convenție
          stabilește riscurile comune, măsurile, coordonarea, instruirea și organizarea în caz de urgență. După semnarea
          de către toate părțile, convenția se activează și se publică în dosarul de control al punctului de lucru.
        </p>

        {uncovered.length ? (
          <div className="callout-warn" role="status">
            <strong>Firme terțe intrate pe poartă fără convenție activă (ultimele 90 de zile)</strong>
            <ul className="ssm-convention-uncovered">
              {uncovered.slice(0, 8).map((row) => (
                <li key={`${row.worksiteId}-${row.companyName}`}>
                  <span>
                    {row.companyName} · {row.worksiteName} · {row.visits} intrări, ultima {formatRoDate(row.lastVisitAt)}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          worksiteId: row.worksiteId,
                          title: `Convenție SSM — ${row.companyName} / ${row.worksiteName}`,
                          firstParty: { ...EMPTY_PARTY, companyName: row.companyName }
                        }))
                      }
                    >
                      Pregătește convenția
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="ssm-inline-actions">
          <FieldSelect
            id="conv-filter-worksite"
            label="Punct de lucru"
            value={filters.worksiteId}
            onChange={(worksiteId) => setFilters((prev) => ({ ...prev, worksiteId }))}
            allowEmpty
            emptyLabel="Toate"
            options={worksiteOptions}
          />
          <FieldSelect
            id="conv-filter-status"
            label="Stare"
            value={filters.status}
            onChange={(status) => setFilters((prev) => ({ ...prev, status: status as SsmConventionStatus | "" }))}
            allowEmpty
            emptyLabel="Toate"
            options={SSM_CONVENTION_STATUSES.map((status) => ({
              value: status,
              label: SSM_CONVENTION_STATUS_LABELS[status]
            }))}
          />
        </div>

        {listQuery.isError ? <p className="feedback error">{errorMessage(listQuery.error)}</p> : null}
        <div className="ssm-doc-items">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ssm-doc-item ${selectedId === item.id ? "selected" : ""}`}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>
                {item.number} · {item.title}
              </strong>
              <span>
                {item.worksiteName} · {item.parties.filter((party) => !party.isHost).length} firme terțe ·{" "}
                {formatRoDate(item.startsAt)} – {item.endsAt ? formatRoDate(item.endsAt) : "nedeterminat"}
                {item.status === "ACTIVE" && item.daysUntilEnd != null && item.daysUntilEnd <= 30
                  ? ` · expiră în ${item.daysUntilEnd} zile`
                  : ""}
              </span>
              <span className={statusChip(item.status)}>{SSM_CONVENTION_STATUS_LABELS[item.status]}</span>
            </button>
          ))}
          {!listQuery.isLoading && !items.length ? <p className="field-hint">Nu există convenții în filtru.</p> : null}
        </div>

        {canEdit ? (
          <form className="form-stack" onSubmit={onCreate}>
            <h5 className="ssm-subtitle">Convenție nouă</h5>
            <FieldSelect
              id="conv-create-worksite"
              label="Loc de muncă comun (șantier / depozit)"
              value={createForm.worksiteId}
              onChange={(worksiteId) => setCreateForm((prev) => ({ ...prev, worksiteId }))}
              allowEmpty
              emptyLabel="Selectează punctul de lucru"
              options={worksiteOptions}
              required
            />
            <div className="field">
              <label htmlFor="conv-create-title">Titlu</label>
              <input
                id="conv-create-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                minLength={3}
              />
            </div>
            <div className="ssm-inline-actions">
              <div className="field">
                <label htmlFor="conv-create-start">Valabilă din</label>
                <input
                  id="conv-create-start"
                  type="date"
                  value={createForm.startsAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="conv-create-end">Până la (opțional)</label>
                <input
                  id="conv-create-end"
                  type="date"
                  value={createForm.endsAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="conv-create-company">Prima firmă terță</label>
              <input
                id="conv-create-company"
                value={createForm.firstParty.companyName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, firstParty: { ...prev.firstParty, companyName: event.target.value } }))
                }
                placeholder="Denumire societate"
              />
            </div>
            <div className="field">
              <label htmlFor="conv-create-rep">Reprezentant legal firmă terță</label>
              <input
                id="conv-create-rep"
                value={createForm.firstParty.representativeName}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    firstParty: { ...prev.firstParty, representativeName: event.target.value }
                  }))
                }
                required={Boolean(createForm.firstParty.companyName.trim())}
              />
            </div>
            <p className="field-hint">
              Beneficiarul (entitatea care deține punctul de lucru) este adăugat automat ca parte gazdă.
            </p>
            <button className="btn-primary" type="submit" disabled={createConvention.isPending || !createForm.worksiteId}>
              {createConvention.isPending ? "Se creează…" : "Creează convenția (ciornă)"}
            </button>
            {createConvention.isError ? <p className="feedback error">{errorMessage(createConvention.error)}</p> : null}
          </form>
        ) : null}
      </div>

      <div className="card form-stack ssm-doc-card">
        {!selected || !draft ? (
          <p className="field-hint">Selectează sau creează o convenție.</p>
        ) : (
          <>
            <div className="ssm-card-header">
              <h4 className="card-title">
                {selected.number} · {selected.title}
              </h4>
              <span className={statusChip(selected.status)}>{SSM_CONVENTION_STATUS_LABELS[selected.status]}</span>
            </div>
            <p className="field-hint">
              {selected.worksiteName}
              {selected.legalEntityName ? ` · ${selected.legalEntityName}` : ""} · semnături {selected.signedCount}/
              {selected.parties.length}
              {selected.documentId ? " · publicată în dosarul de control" : ""}
              {selected.terminationReason ? ` · încetată: ${selected.terminationReason}` : ""}
            </p>

            <div className="ssm-inline-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => download(selected.id, `conventie-ssm-${selected.number}.pdf`)}
              >
                Descarcă PDF
              </button>
              {canEdit && isDraft ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selected.readyToActivate || activate.isPending}
                  title={selected.readyToActivate ? undefined : "Toate părțile trebuie să semneze"}
                  onClick={() => activate.mutate(selected.id)}
                >
                  {activate.isPending ? "Se activează…" : "Activează și publică"}
                </button>
              ) : null}
              {canEdit && isDraft ? (
                <button
                  type="button"
                  className="btn-text"
                  disabled={deleteConvention.isPending}
                  onClick={() => {
                    if (!window.confirm("Ștergi ciorna convenției?")) return;
                    deleteConvention.mutate(selected.id, { onSuccess: () => setSelectedId(undefined) });
                  }}
                >
                  Șterge ciorna
                </button>
              ) : null}
            </div>
            {actionError ? <p className="feedback error">{actionError}</p> : null}
            {activate.isError ? <p className="feedback error">{errorMessage(activate.error)}</p> : null}

            {canEdit && selected.status === "ACTIVE" ? (
              <div className="ssm-inline-actions">
                <div className="field">
                  <label htmlFor="conv-terminate-reason">Motiv încetare</label>
                  <input
                    id="conv-terminate-reason"
                    value={terminateReason}
                    onChange={(event) => setTerminateReason(event.target.value)}
                    placeholder="ex. finalizare lucrări"
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={terminate.isPending}
                  onClick={() =>
                    terminate.mutate(
                      { conventionId: selected.id, reason: terminateReason.trim() || undefined },
                      { onSuccess: () => setTerminateReason("") }
                    )
                  }
                >
                  Încetează convenția
                </button>
                {terminate.isError ? <p className="feedback error">{errorMessage(terminate.error)}</p> : null}
              </div>
            ) : null}

            <h5 className="ssm-subtitle">Părți și semnături</h5>
            <div className="ssm-history-list">
              {selected.parties.map((party) => (
                <div key={party.id} className="ssm-history-item ssm-history-item--stack">
                  <div>
                    <strong>
                      {party.companyName}
                      {party.cui ? ` (CUI ${party.cui})` : ""}
                    </strong>
                    <div className="field-hint">
                      {party.isHost ? "Beneficiar / gazdă" : "Firmă terță"} · {party.representativeName}
                      {party.representativeFunction ? `, ${party.representativeFunction}` : ""}
                      {party.ssmContactName ? ` · contact SSM ${party.ssmContactName}` : ""}
                      {party.ssmContactPhone ? ` ${party.ssmContactPhone}` : ""}
                    </div>
                  </div>
                  <div className="ssm-inline-actions">
                    <span className={party.signed ? "ssm-chip good" : "ssm-chip warn"}>
                      {party.signed ? `Semnat ${formatRoDate(party.signedAt)}` : "Nesemnat"}
                    </span>
                    {editable && !party.signed ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setSigningPartyId(party.id);
                          setSignature("");
                        }}
                      >
                        Semnează
                      </button>
                    ) : null}
                    {editable && !party.isHost ? (
                      <button
                        type="button"
                        className="btn-text"
                        disabled={removeParty.isPending}
                        onClick={() => removeParty.mutate({ conventionId: selected.id, partyId: party.id })}
                      >
                        Elimină
                      </button>
                    ) : null}
                  </div>
                  {signingPartyId === party.id ? (
                    <div className="form-stack">
                      <SignatureCanvas
                        value={signature}
                        onChange={setSignature}
                        label={`Semnătura reprezentantului ${party.companyName}`}
                      />
                      <div className="ssm-inline-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!signature.startsWith("data:image") || signParty.isPending}
                          onClick={() =>
                            signParty.mutate(
                              { conventionId: selected.id, partyId: party.id, signature },
                              { onSuccess: () => setSigningPartyId(null) }
                            )
                          }
                        >
                          {signParty.isPending ? "Se semnează…" : "Confirmă semnătura"}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setSigningPartyId(null)}>
                          Renunță
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {signParty.isError ? <p className="feedback error">{errorMessage(signParty.error)}</p> : null}
            {removeParty.isError ? <p className="feedback error">{errorMessage(removeParty.error)}</p> : null}

            {editable ? (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  addParty.mutate(
                    { conventionId: selected.id, payload: trimmedParty(partyForm) },
                    { onSuccess: () => setPartyForm({ ...EMPTY_PARTY }) }
                  );
                }}
              >
                <h5 className="ssm-subtitle">Adaugă firmă terță</h5>
                <div className="ssm-inline-actions">
                  <div className="field">
                    <label htmlFor="conv-party-company">Societate</label>
                    <input
                      id="conv-party-company"
                      value={partyForm.companyName}
                      onChange={(event) => setPartyForm((prev) => ({ ...prev, companyName: event.target.value }))}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="conv-party-cui">CUI</label>
                    <input
                      id="conv-party-cui"
                      value={partyForm.cui ?? ""}
                      onChange={(event) => setPartyForm((prev) => ({ ...prev, cui: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="ssm-inline-actions">
                  <div className="field">
                    <label htmlFor="conv-party-rep">Reprezentant legal</label>
                    <input
                      id="conv-party-rep"
                      value={partyForm.representativeName}
                      onChange={(event) => setPartyForm((prev) => ({ ...prev, representativeName: event.target.value }))}
                      required
                      minLength={3}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="conv-party-workers">Nr. lucrători pe loc</label>
                    <input
                      id="conv-party-workers"
                      type="number"
                      min={0}
                      value={partyForm.workersCount ?? ""}
                      onChange={(event) =>
                        setPartyForm((prev) => ({
                          ...prev,
                          workersCount: event.target.value === "" ? undefined : Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="ssm-inline-actions">
                  <div className="field">
                    <label htmlFor="conv-party-contact">Persoană contact SSM</label>
                    <input
                      id="conv-party-contact"
                      value={partyForm.ssmContactName ?? ""}
                      onChange={(event) => setPartyForm((prev) => ({ ...prev, ssmContactName: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="conv-party-email">E-mail contact SSM</label>
                    <input
                      id="conv-party-email"
                      type="email"
                      value={partyForm.ssmContactEmail ?? ""}
                      onChange={(event) => setPartyForm((prev) => ({ ...prev, ssmContactEmail: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="conv-party-obligations">Obligații specifice ale firmei</label>
                  <textarea
                    id="conv-party-obligations"
                    rows={2}
                    value={partyForm.obligations ?? ""}
                    onChange={(event) => setPartyForm((prev) => ({ ...prev, obligations: event.target.value }))}
                  />
                </div>
                <button className="btn-secondary" type="submit" disabled={addParty.isPending}>
                  {addParty.isPending ? "Se adaugă…" : "Adaugă firma"}
                </button>
                {addParty.isError ? <p className="feedback error">{errorMessage(addParty.error)}</p> : null}
              </form>
            ) : null}

            <form className="form-stack" onSubmit={onSaveDraft}>
              <h5 className="ssm-subtitle">Clauze</h5>
              {editable ? (
                <p className="field-hint">Orice modificare a clauzelor sau a părților resetează semnăturile colectate.</p>
              ) : null}
              <div className="ssm-inline-actions">
                <div className="field">
                  <label htmlFor="conv-coord-name">Coordonator SSM loc comun</label>
                  <input
                    id="conv-coord-name"
                    value={draft.coordinatorName}
                    disabled={!editable}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, coordinatorName: event.target.value } : prev))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="conv-coord-email">E-mail coordonator</label>
                  <input
                    id="conv-coord-email"
                    type="email"
                    value={draft.coordinatorEmail}
                    disabled={!editable}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, coordinatorEmail: event.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="ssm-inline-actions">
                <div className="field">
                  <label htmlFor="conv-draft-start">Valabilă din</label>
                  <input
                    id="conv-draft-start"
                    type="date"
                    value={draft.startsAt}
                    disabled={!editable}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, startsAt: event.target.value } : prev))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="conv-draft-end">Până la</label>
                  <input
                    id="conv-draft-end"
                    type="date"
                    value={draft.endsAt}
                    disabled={!editable}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, endsAt: event.target.value } : prev))}
                  />
                </div>
              </div>
              {CLAUSES.map((clause) => (
                <div key={clause.key} className="field">
                  <label htmlFor={`conv-clause-${clause.key}`}>{clause.label}</label>
                  <textarea
                    id={`conv-clause-${clause.key}`}
                    rows={3}
                    value={draft[clause.key]}
                    disabled={!editable}
                    placeholder={clause.placeholder}
                    onChange={(event) =>
                      setDraft((prev) => (prev ? { ...prev, [clause.key]: event.target.value } : prev))
                    }
                  />
                </div>
              ))}
              {editable ? (
                <button className="btn-primary" type="submit" disabled={updateConvention.isPending}>
                  {updateConvention.isPending ? "Se salvează…" : "Salvează clauzele"}
                </button>
              ) : null}
              {updateConvention.isError ? (
                <p className="feedback error">{errorMessage(updateConvention.error)}</p>
              ) : null}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
