import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateWorksitePayload,
  UpdateWorksitePayload,
  WorksiteItem
} from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useCreateWorksite,
  useDeleteWorksite,
  useLegalEntitiesLookup,
  useUpdateWorksite,
  useWorksites
} from "../hooks/useMasterData";
import {
  ACTIVE_STATUS_CARD_OPTIONS,
  MASTER_DATA_ADD_LABELS,
  activeLabel,
  activeTone,
  mutationErrorMessage
} from "../master-data-shared";
import { MasterDataCreateModal } from "./MasterDataCreateModal";

const EMPTY_FORM: CreateWorksitePayload = {
  code: "",
  name: "",
  address: "",
  active: true
};

function toEditForm(item: WorksiteItem): UpdateWorksitePayload {
  return {
    code: item.code,
    name: item.name,
    address: item.address ?? "",
    legalEntityId: item.legalEntityId ?? undefined,
    active: item.active
  };
}

export function MasterDataWorksitesPanel() {
  const pagination = usePagination();
  const query = useWorksites(pagination.params);
  const legalEntities = useLegalEntitiesLookup();
  const createWorksite = useCreateWorksite();
  const updateWorksite = useUpdateWorksite();
  const deleteWorksite = useDeleteWorksite();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateWorksitePayload>(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState<WorksiteItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateWorksitePayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter(
      (item) => item.code.toLowerCase().includes(queryText) || item.name.toLowerCase().includes(queryText)
    );
  }, [paged.items, search]);

  const legalEntityOptions = mapToOptions(
    legalEntities.data?.items ?? [],
    (entity) => entity.id,
    (entity) => `${entity.code} — ${entity.name}`
  );

  useEffect(() => {
    if (!editingItem || query.isFetching) return;
    if (!paged.items.some((entry) => entry.id === editingItem.id)) {
      setEditingItem(null);
      setEditForm(null);
    }
  }, [paged.items, editingItem, query.isFetching]);

  const openEdit = (item: WorksiteItem) => {
    setFeedback(null);
    setEditingItem(item);
    setEditForm(toEditForm(item));
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditForm(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    createWorksite.mutate(
      { ...form, code: form.code.trim(), name: form.name.trim(), address: form.address?.trim() || undefined },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
          setFeedback({ type: "success", message: "Punctul de lucru a fost adăugat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem || !editForm) return;
    setFeedback(null);
    updateWorksite.mutate(
      {
        id: editingItem.id,
        payload: {
          code: editForm.code?.trim(),
          name: editForm.name?.trim(),
          address: editForm.address?.trim() || undefined,
          legalEntityId: editForm.legalEntityId?.trim() || "",
          active: editForm.active
        }
      },
      {
        onSuccess: () => {
          closeEdit();
          setFeedback({ type: "success", message: "Punctul de lucru a fost actualizat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onToggleActive = () => {
    if (!editingItem) return;
    setFeedback(null);
    const nextActive = !editingItem.active;
    updateWorksite.mutate(
      { id: editingItem.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          setEditingItem((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setEditForm((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setFeedback({
            type: "success",
            message: nextActive ? "Punctul de lucru a fost activat." : "Punctul de lucru a fost dezactivat."
          });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onDelete = () => {
    if (!editingItem) return;
    const confirmed = window.confirm(
      `Ștergi punctul de lucru „${editingItem.name}”? Această acțiune nu poate fi anulată.`
    );
    if (!confirmed) return;
    setFeedback(null);
    deleteWorksite.mutate(editingItem.id, {
      onSuccess: () => {
        closeEdit();
        setFeedback({ type: "success", message: "Punctul de lucru a fost șters." });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const mutationPending = updateWorksite.isPending || deleteWorksite.isPending;

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Puncte de lucru</h2>
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
            {MASTER_DATA_ADD_LABELS.worksites}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-worksite-search">Caută</label>
            <input
              id="md-worksite-search"
              type="search"
              placeholder="Cod sau denumire..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {feedback && !showForm && !editingItem ? (
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
                <th>Adresă</th>
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
                    <p>Nu am găsit puncte de lucru{search ? " pentru căutare" : ""}.</p>
                    {!search ? (
                      <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                        Adaugă primul punct de lucru
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {items.map((item: WorksiteItem) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.address || "—"}</td>
                  <td>
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>
                      {activeLabel(item.active)}
                    </span>
                  </td>
                  <td className="comms-actions-cell">
                    <div className="comms-row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(item)}>
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
          title="Punct de lucru nou"
          titleId="md-worksite-create-title"
          onClose={() => setShowForm(false)}
        >
          <form className="form-stack" onSubmit={onSubmit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-worksite-code">Cod *</label>
                <input
                  id="md-worksite-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Ex: HQ"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-worksite-name">Denumire *</label>
                <input
                  id="md-worksite-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Sediu central"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="md-worksite-address">Adresă</label>
              <input
                id="md-worksite-address"
                value={form.address ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Strada, oraș..."
              />
            </div>
            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createWorksite.isPending}>
                {createWorksite.isPending ? "Se salvează..." : "Salvează"}
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

      {editingItem && editForm ? (
        <MasterDataCreateModal
          title={`Editează: ${editingItem.name}`}
          titleId="md-worksite-edit-title"
          description={editingItem.code}
          onClose={closeEdit}
        >
          <form className="form-stack" onSubmit={onSaveEdit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-worksite-edit-code">Cod *</label>
                <input
                  id="md-worksite-edit-code"
                  required
                  value={editForm.code ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-worksite-edit-name">Denumire *</label>
                <input
                  id="md-worksite-edit-name"
                  required
                  value={editForm.name ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="md-worksite-edit-address">Adresă</label>
              <input
                id="md-worksite-edit-address"
                value={editForm.address ?? ""}
                onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>
            <FieldSelect
              id="md-worksite-edit-entity"
              label="Entitate juridică"
              value={editForm.legalEntityId ?? ""}
              onChange={(value) =>
                setEditForm((prev) => ({ ...prev, legalEntityId: value || undefined }))
              }
              options={legalEntityOptions}
              allowEmpty
              emptyLabel="—"
            />
            <OptionCardRadioGroup
              name="md-worksite-edit-active"
              legend="Status"
              value={editForm.active ? "true" : "false"}
              onChange={(value) => setEditForm((prev) => ({ ...prev, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={mutationPending}>
                {updateWorksite.isPending ? "Se salvează…" : "Salvează modificările"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={mutationPending}
                onClick={onToggleActive}
              >
                {editingItem.active ? "Dezactivează" : "Activează"}
              </button>
              <button
                type="button"
                className="btn-secondary btn-danger"
                disabled={mutationPending}
                onClick={onDelete}
              >
                {deleteWorksite.isPending ? "Se șterge…" : "Șterge"}
              </button>
              <button type="button" className="btn-secondary" onClick={closeEdit}>
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
