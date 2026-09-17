import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmDangerousSubstanceRequest,
  SsmDangerousSubstanceHazard,
  SsmDangerousSubstanceItem,
  SsmDangerousSubstanceStatus,
  SsmDangerousSubstanceUnit,
  UpdateSsmDangerousSubstanceRequest
} from "@repo/shared-types/ssm";
import {
  SSM_DANGEROUS_SUBSTANCE_HAZARD_LABELS,
  SSM_DANGEROUS_SUBSTANCE_HAZARDS,
  SSM_DANGEROUS_SUBSTANCE_STATUS_LABELS,
  SSM_DANGEROUS_SUBSTANCE_STATUSES,
  SSM_DANGEROUS_SUBSTANCE_UNIT_LABELS,
  SSM_DANGEROUS_SUBSTANCE_UNITS
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import {
  useCreateDangerousSubstance,
  useDangerousSubstances,
  useRetireDangerousSubstance,
  useUpdateDangerousSubstance
} from "../hooks/useSsmSubstances";

type SubstancesTab = "register" | "add" | "update";

const TABS: Array<{ id: SubstancesTab; title: string; caption: string }> = [
  { id: "register", title: "Registru", caption: "Stoc pe locație" },
  { id: "add", title: "Înregistrare", caption: "Substanță nouă" },
  { id: "update", title: "Actualizare", caption: "Cantitate, SDS, status" }
];

const EMPTY_CREATE: CreateSsmDangerousSubstanceRequest = {
  worksiteId: "",
  name: "",
  tradeName: "",
  casNumber: "",
  unNumber: "",
  hazardClass: "OTHER",
  location: "",
  quantity: 0,
  unit: "L",
  containerType: "",
  sdsValidUntil: "",
  responsibleName: "",
  notes: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ro-RO");
}

function formatQuantity(item: SsmDangerousSubstanceItem): string {
  const amount = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(3);
  return `${amount} ${SSM_DANGEROUS_SUBSTANCE_UNIT_LABELS[item.unit]}`;
}

function statusChip(status: SsmDangerousSubstanceStatus): string {
  if (status === "ACTIVE") return "good";
  if (status === "DEPLETED") return "warn";
  return "bad";
}

export function SsmSubstancesManager() {
  const session = useAuthSession();
  const canEdit = hasPermission(session?.roles, "ssm:documents:edit");
  const [tab, setTab] = useState<SubstancesTab>("register");
  const [worksiteFilter, setWorksiteFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<UpdateSsmDangerousSubstanceRequest>({});
  const [createSds, setCreateSds] = useState<File>();
  const [editSds, setEditSds] = useState<File>();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const worksitesLookup = useWorksitesLookup();
  const listQuery = useDangerousSubstances(worksiteFilter || undefined);
  const createMutation = useCreateDangerousSubstance();
  const updateMutation = useUpdateDangerousSubstance();
  const retireMutation = useRetireDangerousSubstance();

  const items = listQuery.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId);

  const worksiteOptions = mapToOptions(
    worksitesLookup.data?.items ?? [],
    (item) => item.id,
    (item) => `${item.code} — ${item.name}`
  );

  const hazardOptions = useMemo(
    () => SSM_DANGEROUS_SUBSTANCE_HAZARDS.map((value) => ({ value, label: SSM_DANGEROUS_SUBSTANCE_HAZARD_LABELS[value] })),
    []
  );
  const unitOptions = useMemo(
    () => SSM_DANGEROUS_SUBSTANCE_UNITS.map((value) => ({ value, label: SSM_DANGEROUS_SUBSTANCE_UNIT_LABELS[value] })),
    []
  );
  const statusOptions = useMemo(
    () => SSM_DANGEROUS_SUBSTANCE_STATUSES.map((value) => ({ value, label: SSM_DANGEROUS_SUBSTANCE_STATUS_LABELS[value] })),
    []
  );

  useEffect(() => {
    const first = worksitesLookup.data?.items[0];
    if (!first) return;
    setCreateForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: first.id }));
  }, [worksitesLookup.data?.items]);

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    if (!selected) {
      setEditForm({});
      return;
    }
    setEditForm({
      name: selected.name,
      tradeName: selected.tradeName ?? "",
      casNumber: selected.casNumber ?? "",
      unNumber: selected.unNumber ?? "",
      hazardClass: selected.hazardClass,
      location: selected.location,
      quantity: selected.quantity,
      unit: selected.unit,
      containerType: selected.containerType ?? "",
      sdsValidUntil: selected.sdsValidUntil ? selected.sdsValidUntil.slice(0, 10) : "",
      responsibleName: selected.responsibleName ?? "",
      notes: selected.notes ?? "",
      status: selected.status
    });
    setEditSds(undefined);
  }, [selected]);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate(
      {
        payload: {
          ...createForm,
          tradeName: createForm.tradeName?.trim() || undefined,
          casNumber: createForm.casNumber?.trim() || undefined,
          unNumber: createForm.unNumber?.trim() || undefined,
          containerType: createForm.containerType?.trim() || undefined,
          sdsValidUntil: createForm.sdsValidUntil?.trim() || undefined,
          responsibleName: createForm.responsibleName?.trim() || undefined,
          notes: createForm.notes?.trim() || undefined
        },
        sdsSheet: createSds
      },
      {
        onSuccess: () => {
          setCreateForm((prev) => ({ ...EMPTY_CREATE, worksiteId: prev.worksiteId }));
          setCreateSds(undefined);
          setTab("register");
        }
      }
    );
  };

  const onUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      payload: {
        ...editForm,
        tradeName: editForm.tradeName?.toString().trim() || null,
        casNumber: editForm.casNumber?.toString().trim() || null,
        unNumber: editForm.unNumber?.toString().trim() || null,
        containerType: editForm.containerType?.toString().trim() || null,
        sdsValidUntil: editForm.sdsValidUntil?.toString().trim() || null,
        responsibleName: editForm.responsibleName?.toString().trim() || null,
        notes: editForm.notes?.toString().trim() || null
      },
      sdsSheet: editSds
    });
  };

  const downloadSds = (item: SsmDangerousSubstanceItem) => {
    setDownloadError(null);
    void downloadWithAuth(ssmApi.getDangerousSubstanceSdsUrl(item.id), item.sdsSheetName || "sds.pdf").catch((error) => {
      setDownloadError(mutationErrorMessage(error));
    });
  };

  return (
    <div className="form-stack">
      <nav className="comms-tabs" aria-label="Substanțe periculoase">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
            disabled={item.id === "add" && !canEdit}
          >
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </button>
        ))}
      </nav>

      {tab === "register" ? (
        <section className="card form-stack ssm-doc-card">
          <FieldSelect
            id="substance-worksite-filter"
            label="Punct de lucru"
            value={worksiteFilter}
            onChange={setWorksiteFilter}
            allowEmpty
            emptyLabel="Toate punctele"
            options={worksiteOptions}
          />
          {listQuery.isLoading ? <p className="field-hint">Se încarcă registrul…</p> : null}
          {listQuery.isError ? <p className="feedback error">{mutationErrorMessage(listQuery.error)}</p> : null}
          {downloadError ? <p className="feedback error">{downloadError}</p> : null}
          {!items.length && !listQuery.isLoading ? (
            <p className="field-hint">Nu există substanțe înregistrate pe filtrul curent.</p>
          ) : null}
          <div className="ssm-history-list">
            {items.map((item) => (
              <div key={item.id} className="ssm-history-item">
                <div>
                  <strong>{item.name}</strong>
                  <div className="field-hint">
                    {item.worksiteCode} · {item.location} · {formatQuantity(item)}
                    {item.casNumber ? ` · CAS ${item.casNumber}` : ""}
                  </div>
                  <div className="field-hint">
                    {SSM_DANGEROUS_SUBSTANCE_HAZARD_LABELS[item.hazardClass]}
                    {item.sdsValidUntil ? ` · SDS până la ${formatRoDate(item.sdsValidUntil)}` : " · fără termen SDS"}
                  </div>
                </div>
                <div className="ssm-inline-actions">
                  <span className={`badge-${statusChip(item.status)}`}>
                    {SSM_DANGEROUS_SUBSTANCE_STATUS_LABELS[item.status]}
                  </span>
                  {item.hasSdsSheet ? (
                    <button type="button" className="btn-text" onClick={() => downloadSds(item)}>
                      Fișă SDS
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => {
                        setSelectedId(item.id);
                        setTab("update");
                      }}
                    >
                      Actualizează
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "add" && canEdit ? (
        <form className="card form-stack ssm-doc-card" onSubmit={onCreate}>
          <p className="field-hint">
            Evidență pe punct de lucru: cantitate, locație de depozitare și fișă SDS (PDF/Word).
          </p>
          <FieldSelect
            id="create-substance-worksite"
            label="Punct de lucru"
            value={createForm.worksiteId}
            onChange={(worksiteId) => setCreateForm((prev) => ({ ...prev, worksiteId }))}
            options={worksiteOptions}
          />
          <div className="field">
            <label htmlFor="create-substance-name">Denumire *</label>
            <input
              id="create-substance-name"
              required
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-trade">Denumire comercială</label>
            <input
              id="create-substance-trade"
              value={createForm.tradeName ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, tradeName: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-cas">Număr CAS</label>
            <input
              id="create-substance-cas"
              value={createForm.casNumber ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, casNumber: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-un">Număr UN</label>
            <input
              id="create-substance-un"
              value={createForm.unNumber ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, unNumber: event.target.value }))}
            />
          </div>
          <FieldSelect
            id="create-substance-hazard"
            label="Clasă de pericol"
            value={createForm.hazardClass ?? "OTHER"}
            onChange={(hazardClass) =>
              setCreateForm((prev) => ({ ...prev, hazardClass: hazardClass as SsmDangerousSubstanceHazard }))
            }
            options={hazardOptions}
          />
          <div className="field">
            <label htmlFor="create-substance-location">Locație depozitare *</label>
            <input
              id="create-substance-location"
              required
              value={createForm.location}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-qty">Cantitate *</label>
            <input
              id="create-substance-qty"
              type="number"
              min={0}
              step="0.001"
              required
              value={createForm.quantity}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
            />
          </div>
          <FieldSelect
            id="create-substance-unit"
            label="Unitate"
            value={createForm.unit ?? "L"}
            onChange={(unit) => setCreateForm((prev) => ({ ...prev, unit: unit as SsmDangerousSubstanceUnit }))}
            options={unitOptions}
          />
          <div className="field">
            <label htmlFor="create-substance-container">Ambalaj / recipient</label>
            <input
              id="create-substance-container"
              value={createForm.containerType ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, containerType: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-sds-date">Valabilitate fișă SDS</label>
            <input
              id="create-substance-sds-date"
              type="date"
              value={createForm.sdsValidUntil ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, sdsValidUntil: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-responsible">Responsabil</label>
            <input
              id="create-substance-responsible"
              value={createForm.responsibleName ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, responsibleName: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-notes">Observații</label>
            <input
              id="create-substance-notes"
              value={createForm.notes ?? ""}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="create-substance-sds">Fișă SDS (PDF/Word)</label>
            <input
              id="create-substance-sds"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setCreateSds(event.target.files?.[0])}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Se salvează…" : "Adaugă în registru"}
          </button>
          {createMutation.isError ? (
            <p className="feedback error">{mutationErrorMessage(createMutation.error)}</p>
          ) : null}
        </form>
      ) : null}

      {tab === "update" ? (
        <section className="card form-stack ssm-doc-card">
          {!items.length ? (
            <p className="field-hint">Nu există substanțe de actualizat.</p>
          ) : (
            <>
              <FieldSelect
                id="update-substance-select"
                label="Substanță"
                value={selectedId}
                onChange={setSelectedId}
                options={items.map((item) => ({
                  value: item.id,
                  label: `${item.name} · ${item.location} (${formatQuantity(item)})`
                }))}
              />
              {selected && canEdit ? (
                <form className="form-stack" onSubmit={onUpdate}>
                  <div className="field">
                    <label htmlFor="edit-substance-name">Denumire</label>
                    <input
                      id="edit-substance-name"
                      value={editForm.name ?? ""}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-substance-location">Locație depozitare</label>
                    <input
                      id="edit-substance-location"
                      value={editForm.location ?? ""}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-substance-qty">Cantitate</label>
                    <input
                      id="edit-substance-qty"
                      type="number"
                      min={0}
                      step="0.001"
                      value={editForm.quantity ?? 0}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                    />
                  </div>
                  <FieldSelect
                    id="edit-substance-unit"
                    label="Unitate"
                    value={editForm.unit ?? "L"}
                    onChange={(unit) => setEditForm((prev) => ({ ...prev, unit: unit as SsmDangerousSubstanceUnit }))}
                    options={unitOptions}
                  />
                  <FieldSelect
                    id="edit-substance-hazard"
                    label="Clasă de pericol"
                    value={editForm.hazardClass ?? "OTHER"}
                    onChange={(hazardClass) =>
                      setEditForm((prev) => ({ ...prev, hazardClass: hazardClass as SsmDangerousSubstanceHazard }))
                    }
                    options={hazardOptions}
                  />
                  <FieldSelect
                    id="edit-substance-status"
                    label="Status"
                    value={editForm.status ?? "ACTIVE"}
                    onChange={(status) =>
                      setEditForm((prev) => ({ ...prev, status: status as SsmDangerousSubstanceStatus }))
                    }
                    options={statusOptions}
                  />
                  <div className="field">
                    <label htmlFor="edit-substance-cas">Număr CAS</label>
                    <input
                      id="edit-substance-cas"
                      value={editForm.casNumber ?? ""}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, casNumber: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-substance-sds-date">Valabilitate fișă SDS</label>
                    <input
                      id="edit-substance-sds-date"
                      type="date"
                      value={editForm.sdsValidUntil ?? ""}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, sdsValidUntil: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-substance-responsible">Responsabil</label>
                    <input
                      id="edit-substance-responsible"
                      value={editForm.responsibleName ?? ""}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, responsibleName: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-substance-sds">Înlocuire fișă SDS</label>
                    <input
                      id="edit-substance-sds"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(event) => setEditSds(event.target.files?.[0])}
                    />
                    {selected.sdsSheetName ? (
                      <p className="field-hint">Fișă curentă: {selected.sdsSheetName}</p>
                    ) : null}
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Se salvează…" : "Salvează"}
                    </button>
                    {selected.status !== "RETIRED" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={retireMutation.isPending}
                        onClick={() => retireMutation.mutate(selected.id)}
                      >
                        Scoate din evidență
                      </button>
                    ) : null}
                  </div>
                  {updateMutation.isSuccess ? (
                    <p className="feedback success" role="status">
                      Registrul a fost actualizat.
                    </p>
                  ) : null}
                  {updateMutation.isError ? (
                    <p className="feedback error">{mutationErrorMessage(updateMutation.error)}</p>
                  ) : null}
                  {retireMutation.isError ? (
                    <p className="feedback error">{mutationErrorMessage(retireMutation.error)}</p>
                  ) : null}
                </form>
              ) : null}
              {!canEdit ? <p className="field-hint">Ai drept de vizualizare, fără editare.</p> : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
