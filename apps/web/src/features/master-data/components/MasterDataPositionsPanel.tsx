import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateJobPositionPayload,
  JobPositionItem,
  UpdateJobPositionPayload
} from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useCreateJobPosition,
  useDeleteJobPosition,
  useDepartmentsLookup,
  useJobPositions,
  useLegalEntitiesLookup,
  useUpdateJobPosition,
  useWorksitesLookup
} from "../hooks/useMasterData";
import {
  ACTIVE_STATUS_CARD_OPTIONS,
  MASTER_DATA_ADD_LABELS,
  activeLabel,
  activeTone,
  mutationErrorMessage
} from "../master-data-shared";
import { MasterDataCreateModal } from "./MasterDataCreateModal";

const EMPTY_FORM: CreateJobPositionPayload = {
  code: "",
  name: "",
  legalEntityId: "",
  worksiteId: "",
  departmentId: "",
  corCode: "",
  description: "",
  activityDescription: "",
  active: true
};

function toEditForm(item: JobPositionItem): UpdateJobPositionPayload {
  return {
    code: item.code,
    name: item.name,
    legalEntityId: item.legalEntityId ?? "",
    worksiteId: item.worksiteId ?? "",
    departmentId: item.departmentId ?? "",
    corCode: item.corCode ?? "",
    description: item.description ?? "",
    activityDescription: item.activityDescription ?? "",
    active: item.active
  };
}

export function MasterDataPositionsPanel() {
  const pagination = usePagination();
  const query = useJobPositions(pagination.params);
  const departmentsLookup = useDepartmentsLookup();
  const legalEntitiesLookup = useLegalEntitiesLookup();
  const worksitesLookup = useWorksitesLookup();
  const createJobPosition = useCreateJobPosition();
  const updateJobPosition = useUpdateJobPosition();
  const deleteJobPosition = useDeleteJobPosition();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const departmentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of departmentsLookup.data?.items ?? []) {
      map.set(item.id, `${item.code} - ${item.name}`);
    }
    return map;
  }, [departmentsLookup.data?.items]);

  const legalEntityOptions = mapToOptions(
    legalEntitiesLookup.data?.items ?? [],
    (entity) => entity.id,
    (entity) => `${entity.code} - ${entity.name}`
  );
  const worksiteOptions = mapToOptions(
    worksitesLookup.data?.items ?? [],
    (worksite) => worksite.id,
    (worksite) => `${worksite.code} - ${worksite.name}`
  );
  const departmentOptions = mapToOptions(
    departmentsLookup.data?.items ?? [],
    (department) => department.id,
    (department) => `${department.code} - ${department.name}`
  );

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateJobPositionPayload>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateJobPositionPayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selected = useMemo(
    () => paged.items.find((item) => item.id === selectedId) ?? null,
    [paged.items, selectedId]
  );

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter(
      (item) =>
        item.code.toLowerCase().includes(queryText) ||
        item.name.toLowerCase().includes(queryText) ||
        (item.corCode ?? "").toLowerCase().includes(queryText)
    );
  }, [paged.items, search]);

  useEffect(() => {
    if (!selectedId || query.isFetching) return;
    if (!paged.items.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setEditForm(null);
    }
  }, [paged.items, selectedId, query.isFetching]);

  const openDetails = (item: JobPositionItem) => {
    setFeedback(null);
    setSelectedId(item.id);
    setEditForm(toEditForm(item));
  };

  const closeDetails = () => {
    setSelectedId(null);
    setEditForm(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    createJobPosition.mutate(
      {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        legalEntityId: form.legalEntityId || undefined,
        worksiteId: form.worksiteId || undefined,
        departmentId: form.departmentId || undefined,
        corCode: form.corCode?.trim() || undefined,
        description: form.description?.trim() || undefined,
        activityDescription: form.activityDescription?.trim() || undefined
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
          setFeedback({ type: "success", message: "Postul a fost adăugat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !editForm) return;
    setFeedback(null);
    updateJobPosition.mutate(
      {
        id: selectedId,
        payload: {
          code: editForm.code?.trim(),
          name: editForm.name?.trim(),
          legalEntityId: editForm.legalEntityId || "",
          worksiteId: editForm.worksiteId || "",
          departmentId: editForm.departmentId || "",
          corCode: editForm.corCode ?? "",
          description: editForm.description ?? "",
          activityDescription: editForm.activityDescription ?? "",
          active: editForm.active
        }
      },
      {
        onSuccess: () => {
          closeDetails();
          setFeedback({ type: "success", message: "Postul a fost actualizat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onToggleActive = () => {
    if (!selected) return;
    setFeedback(null);
    const nextActive = !selected.active;
    updateJobPosition.mutate(
      { id: selected.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          setEditForm((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setFeedback({
            type: "success",
            message: nextActive ? "Postul a fost activat." : "Postul a fost dezactivat."
          });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onDelete = () => {
    if (!selected) return;
    const confirmed = window.confirm(
      `Ștergi postul „${selected.name}” (${selected.code})? Această acțiune nu poate fi anulată.`
    );
    if (!confirmed) return;
    setFeedback(null);
    deleteJobPosition.mutate(selected.id, {
      onSuccess: () => {
        closeDetails();
        setFeedback({ type: "success", message: "Postul a fost șters." });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const isMutating = updateJobPosition.isPending || deleteJobPosition.isPending;

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Posturi</h2>
            <p className="comms-toolbar-hint">{paged.total} în total</p>
          </div>
          <button
            type="button"
            className="btn-primary comms-toolbar-cta"
            onClick={() => {
              setFeedback(null);
              setShowForm(true);
            }}
          >
            {MASTER_DATA_ADD_LABELS.positions}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-position-search">Caută</label>
            <input
              id="md-position-search"
              type="search"
              placeholder="Cod, denumire sau COR..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {feedback && !showForm && !selectedId ? (
          <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data-table comms-table">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Denumire</th>
                <th>Entitate</th>
                <th>Punct de lucru</th>
                <th>Departament</th>
                <th>COR</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={8} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="comms-empty-cell">
                    <p>Nu am găsit posturi{search ? " pentru căutare" : ""}.</p>
                    {!search ? (
                      <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                        Adaugă primul post
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {items.map((item: JobPositionItem) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.legalEntity ? `${item.legalEntity.code} — ${item.legalEntity.name}` : "—"}</td>
                  <td>{item.worksite ? `${item.worksite.code} — ${item.worksite.name}` : "—"}</td>
                  <td>{item.departmentId ? departmentById.get(item.departmentId) ?? item.departmentId : "—"}</td>
                  <td>{item.corCode || "—"}</td>
                  <td>
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>
                      {activeLabel(item.active)}
                    </span>
                  </td>
                  <td className="comms-actions-cell">
                    <div className="comms-row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openDetails(item)}>
                        Editează
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          disabled={query.isFetching}
        />
      </section>

      {showForm ? (
        <MasterDataCreateModal title="Post nou" titleId="md-position-create-title" onClose={() => setShowForm(false)}>
          <form className="form-stack" onSubmit={onSubmit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-job-code">Cod *</label>
                <input
                  id="md-job-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Ex: DEV01"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-job-name">Denumire *</label>
                <input
                  id="md-job-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Dezvoltator software"
                  required
                />
              </div>
            </div>
            <FieldSelect
              id="md-job-entity"
              label="Entitate juridică"
              value={form.legalEntityId ?? ""}
              onChange={(legalEntityId) => setForm((prev) => ({ ...prev, legalEntityId }))}
              allowEmpty
              emptyLabel="Neselectată"
              options={legalEntityOptions}
            />
            <FieldSelect
              id="md-job-worksite"
              label="Punct de lucru"
              value={form.worksiteId ?? ""}
              onChange={(worksiteId) => setForm((prev) => ({ ...prev, worksiteId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={worksiteOptions}
            />
            <FieldSelect
              id="md-job-department"
              label="Departament (opțional)"
              value={form.departmentId ?? ""}
              onChange={(departmentId) => setForm((prev) => ({ ...prev, departmentId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={departmentOptions}
            />
            <details className="comms-advanced">
              <summary>Câmpuri opționale</summary>
              <div className="comms-form-row">
                <div className="field">
                  <label htmlFor="md-job-cor">Cod COR</label>
                  <input
                    id="md-job-cor"
                    value={form.corCode ?? ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, corCode: event.target.value }))}
                    placeholder="Ex: 251201"
                  />
                </div>
                <div className="field">
                  <label htmlFor="md-job-description">Descriere</label>
                  <input
                    id="md-job-description"
                    value={form.description ?? ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Scurtă descriere..."
                  />
                </div>
              </div>
            </details>
            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createJobPosition.isPending}>
                {createJobPosition.isPending ? "Se salvează..." : "Salvează"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Anulează
              </button>
            </div>
            {feedback ? (
              <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
                {feedback.message}
              </div>
            ) : null}
          </form>
        </MasterDataCreateModal>
      ) : null}

      {selected && editForm ? (
        <MasterDataCreateModal
          title={`Editează: ${selected.name}`}
          titleId="md-position-edit-title"
          description={selected.code}
          onClose={closeDetails}
          size="wide"
        >
          <form className="form-stack" onSubmit={onSaveEdit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-job-edit-code">Cod *</label>
                <input
                  id="md-job-edit-code"
                  required
                  value={editForm.code ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-job-edit-name">Denumire *</label>
                <input
                  id="md-job-edit-name"
                  required
                  value={editForm.name ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>
            <div className="comms-form-row">
              <FieldSelect
                id="md-job-edit-entity"
                label="Entitate juridică"
                value={editForm.legalEntityId ?? ""}
                onChange={(legalEntityId) => setEditForm((prev) => ({ ...prev, legalEntityId }))}
                allowEmpty
                emptyLabel="Neselectată"
                options={legalEntityOptions}
              />
              <FieldSelect
                id="md-job-edit-worksite"
                label="Punct de lucru"
                value={editForm.worksiteId ?? ""}
                onChange={(worksiteId) => setEditForm((prev) => ({ ...prev, worksiteId }))}
                allowEmpty
                emptyLabel="Neselectat"
                options={worksiteOptions}
              />
            </div>
            <FieldSelect
              id="md-job-edit-department"
              label="Departament (opțional)"
              value={editForm.departmentId ?? ""}
              onChange={(departmentId) => setEditForm((prev) => ({ ...prev, departmentId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={departmentOptions}
            />
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-job-edit-cor">Cod COR</label>
                <input
                  id="md-job-edit-cor"
                  value={editForm.corCode ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, corCode: event.target.value }))}
                  placeholder="Ex: 251201"
                />
              </div>
              <div className="field">
                <label htmlFor="md-job-edit-description">Descriere</label>
                <input
                  id="md-job-edit-description"
                  value={editForm.description ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Scurtă descriere..."
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="md-job-edit-activity">Descriere activitate</label>
              <textarea
                id="md-job-edit-activity"
                value={editForm.activityDescription ?? ""}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, activityDescription: event.target.value }))
                }
                rows={2}
                placeholder="Descrierea activității postului..."
              />
            </div>
            <OptionCardRadioGroup
              name="md-job-edit-active"
              legend="Status"
              value={editForm.active ? "true" : "false"}
              onChange={(value) => setEditForm((prev) => ({ ...prev, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={isMutating}>
                {updateJobPosition.isPending ? "Se salvează…" : "Salvează modificările"}
              </button>
              <button type="button" className="btn-secondary" disabled={isMutating} onClick={onToggleActive}>
                {selected.active ? "Dezactivează" : "Activează"}
              </button>
              <button type="button" className="btn-secondary" disabled={isMutating} onClick={onDelete}>
                {deleteJobPosition.isPending ? "Se șterge…" : "Șterge"}
              </button>
              <button type="button" className="btn-secondary" onClick={closeDetails}>
                Anulează
              </button>
            </div>
            {feedback ? (
              <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
                {feedback.message}
              </div>
            ) : null}
          </form>
        </MasterDataCreateModal>
      ) : null}
    </>
  );
}
