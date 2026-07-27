import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateDepartmentPayload,
  DepartmentItem,
  UpdateDepartmentPayload
} from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
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

const EMPTY_FORM: CreateDepartmentPayload = {
  code: "",
  name: "",
  worksiteId: "",
  active: true
};

function toEditForm(item: DepartmentItem): UpdateDepartmentPayload {
  return {
    code: item.code,
    name: item.name,
    worksiteId: item.worksiteId ?? "",
    active: item.active
  };
}

export function MasterDataDepartmentsPanel() {
  const pagination = usePagination();
  const query = useDepartments(pagination.params);
  const worksitesLookup = useWorksitesLookup();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const worksiteById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of worksitesLookup.data?.items ?? []) {
      map.set(item.id, `${item.code} - ${item.name}`);
    }
    return map;
  }, [worksitesLookup.data?.items]);

  const worksiteOptions = mapToOptions(
    worksitesLookup.data?.items ?? [],
    (worksite) => worksite.id,
    (worksite) => `${worksite.code} - ${worksite.name}`
  );

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDepartmentPayload>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateDepartmentPayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selected = useMemo(
    () => paged.items.find((item) => item.id === selectedId) ?? null,
    [paged.items, selectedId]
  );

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter(
      (item) => item.code.toLowerCase().includes(queryText) || item.name.toLowerCase().includes(queryText)
    );
  }, [paged.items, search]);

  useEffect(() => {
    if (!selectedId || query.isFetching) return;
    if (!paged.items.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setEditForm(null);
    }
  }, [paged.items, selectedId, query.isFetching]);

  const openDetails = (item: DepartmentItem) => {
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
    createDepartment.mutate(
      {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        worksiteId: form.worksiteId || undefined
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
          setFeedback({ type: "success", message: "Departamentul a fost adăugat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !editForm) return;
    setFeedback(null);
    updateDepartment.mutate(
      {
        id: selectedId,
        payload: {
          code: editForm.code?.trim(),
          name: editForm.name?.trim(),
          worksiteId: editForm.worksiteId || "",
          active: editForm.active
        }
      },
      {
        onSuccess: () => {
          closeDetails();
          setFeedback({ type: "success", message: "Departamentul a fost actualizat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onToggleActive = () => {
    if (!selected) return;
    setFeedback(null);
    const nextActive = !selected.active;
    updateDepartment.mutate(
      { id: selected.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          setEditForm((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setFeedback({
            type: "success",
            message: nextActive ? "Departamentul a fost activat." : "Departamentul a fost dezactivat."
          });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onDelete = () => {
    if (!selected) return;
    const confirmed = window.confirm(
      `Ștergi departamentul „${selected.name}” (${selected.code})? Această acțiune nu poate fi anulată.`
    );
    if (!confirmed) return;
    setFeedback(null);
    deleteDepartment.mutate(selected.id, {
      onSuccess: () => {
        closeDetails();
        setFeedback({ type: "success", message: "Departamentul a fost șters." });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const isMutating = updateDepartment.isPending || deleteDepartment.isPending;

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Departamente</h2>
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
            {MASTER_DATA_ADD_LABELS.departments}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-department-search">Caută</label>
            <input
              id="md-department-search"
              type="search"
              placeholder="Cod sau denumire..."
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
                <th>Punct de lucru</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={5} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="comms-empty-cell">
                    <p>Nu am găsit departamente{search ? " pentru căutare" : ""}.</p>
                    {!search ? (
                      <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                        Adaugă primul departament
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {items.map((item: DepartmentItem) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.worksiteId ? worksiteById.get(item.worksiteId) ?? item.worksiteId : "—"}</td>
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
        <MasterDataCreateModal
          title="Departament nou"
          titleId="md-department-create-title"
          onClose={() => setShowForm(false)}
        >
          <form className="form-stack" onSubmit={onSubmit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-department-code">Cod *</label>
                <input
                  id="md-department-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Ex: HR"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-department-name">Denumire *</label>
                <input
                  id="md-department-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Resurse umane"
                  required
                />
              </div>
            </div>
            <FieldSelect
              id="md-department-worksite"
              label="Punct de lucru (opțional)"
              value={form.worksiteId ?? ""}
              onChange={(worksiteId) => setForm((prev) => ({ ...prev, worksiteId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={worksiteOptions}
            />
            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createDepartment.isPending}>
                {createDepartment.isPending ? "Se salvează..." : "Salvează"}
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
          titleId="md-department-edit-title"
          description={selected.code}
          onClose={closeDetails}
        >
          <form className="form-stack" onSubmit={onSaveEdit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-department-edit-code">Cod *</label>
                <input
                  id="md-department-edit-code"
                  required
                  value={editForm.code ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-department-edit-name">Denumire *</label>
                <input
                  id="md-department-edit-name"
                  required
                  value={editForm.name ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>
            <FieldSelect
              id="md-department-edit-worksite"
              label="Punct de lucru (opțional)"
              value={editForm.worksiteId ?? ""}
              onChange={(worksiteId) => setEditForm((prev) => ({ ...prev, worksiteId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={worksiteOptions}
            />
            <OptionCardRadioGroup
              name="md-department-edit-active"
              legend="Status"
              value={editForm.active ? "true" : "false"}
              onChange={(value) => setEditForm((prev) => ({ ...prev, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={isMutating}>
                {updateDepartment.isPending ? "Se salvează…" : "Salvează modificările"}
              </button>
              <button type="button" className="btn-secondary" disabled={isMutating} onClick={onToggleActive}>
                {selected.active ? "Dezactivează" : "Activează"}
              </button>
              <button type="button" className="btn-secondary" disabled={isMutating} onClick={onDelete}>
                {deleteDepartment.isPending ? "Se șterge…" : "Șterge"}
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
