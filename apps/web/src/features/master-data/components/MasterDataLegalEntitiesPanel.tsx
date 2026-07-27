import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateLegalEntityPayload,
  CreateWorksitePayload,
  UpdateLegalEntityPayload
} from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useCreateLegalEntity,
  useCreateWorksite,
  useDeleteLegalEntity,
  useLegalEntities,
  useUpdateLegalEntity,
  useWorksitesLookup
} from "../hooks/useMasterData";
import type { LegalEntityItem } from "../master-data-shared";
import {
  ACTIVE_STATUS_CARD_OPTIONS,
  MASTER_DATA_ADD_LABELS,
  activeLabel,
  activeTone,
  mutationErrorMessage
} from "../master-data-shared";
import { MasterDataCreateModal } from "./MasterDataCreateModal";

const EMPTY_FORM: CreateLegalEntityPayload = {
  code: "",
  name: "",
  cui: "",
  headquarters: "",
  worksiteIds: []
};

const EMPTY_WORKSITE_FORM: CreateWorksitePayload = {
  code: "",
  name: "",
  address: "",
  active: true
};

function formatWorksites(item: LegalEntityItem): string {
  if (!item.worksites?.length) return "—";
  return item.worksites.map((worksite) => `${worksite.code} — ${worksite.name}`).join(", ");
}

function toEditForm(item: LegalEntityItem): UpdateLegalEntityPayload {
  return {
    code: item.code,
    name: item.name,
    cui: item.cui ?? "",
    headquarters: item.headquarters ?? "",
    active: item.active
  };
}

export function MasterDataLegalEntitiesPanel() {
  const pagination = usePagination();
  const query = useLegalEntities(pagination.params);
  const worksitesLookup = useWorksitesLookup();
  const createLegalEntity = useCreateLegalEntity();
  const createWorksite = useCreateWorksite();
  const updateLegalEntity = useUpdateLegalEntity();
  const deleteLegalEntity = useDeleteLegalEntity();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateLegalEntityPayload>(EMPTY_FORM);
  const [showNewWorksite, setShowNewWorksite] = useState(false);
  const [worksiteForm, setWorksiteForm] = useState<CreateWorksitePayload>(EMPTY_WORKSITE_FORM);
  const [pendingWorksite, setPendingWorksite] = useState<{ id: string; code: string; name: string } | null>(
    null
  );
  const [editingItem, setEditingItem] = useState<LegalEntityItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateLegalEntityPayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const worksiteSelectOptions = useMemo(() => {
    const items = worksitesLookup.data?.items ?? [];
    const selectedIds = new Set(form.worksiteIds);
    const options = mapToOptions(
      items.filter((worksite) => !worksite.legalEntityId || selectedIds.has(worksite.id)),
      (worksite) => worksite.id,
      (worksite) => `${worksite.code} — ${worksite.name}`
    );
    if (pendingWorksite && !options.some((option) => option.value === pendingWorksite.id)) {
      return [
        { value: pendingWorksite.id, label: `${pendingWorksite.code} — ${pendingWorksite.name}` },
        ...options
      ];
    }
    return options;
  }, [form.worksiteIds, pendingWorksite, worksitesLookup.data?.items]);

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter((item) => {
      const haystack = [
        item.code,
        item.name,
        item.cui ?? "",
        item.headquarters ?? "",
        ...(item.worksites ?? []).flatMap((worksite) => [worksite.code, worksite.name, worksite.address ?? ""])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(queryText);
    });
  }, [paged.items, search]);

  useEffect(() => {
    if (!editingItem || query.isFetching) return;
    if (!paged.items.some((entry) => entry.id === editingItem.id)) {
      setEditingItem(null);
      setEditForm(null);
    }
  }, [paged.items, editingItem, query.isFetching]);

  const openEdit = (item: LegalEntityItem) => {
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
    if (!form.worksiteIds.length) {
      setFeedback({ type: "error", message: "Selectează cel puțin un punct de lucru." });
      return;
    }
    createLegalEntity.mutate(
      {
        code: form.code.trim(),
        name: form.name.trim(),
        cui: form.cui?.trim() || undefined,
        headquarters: form.headquarters?.trim() || undefined,
        worksiteIds: form.worksiteIds
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setWorksiteForm(EMPTY_WORKSITE_FORM);
          setPendingWorksite(null);
          setShowNewWorksite(false);
          setShowForm(false);
          setFeedback({ type: "success", message: "Entitatea juridică a fost adăugată." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onCreateWorksite = () => {
    setFeedback(null);
    if (!worksiteForm.code.trim() || !worksiteForm.name.trim()) {
      setFeedback({ type: "error", message: "Completează codul și denumirea punctului de lucru." });
      return;
    }
    createWorksite.mutate(
      {
        code: worksiteForm.code.trim(),
        name: worksiteForm.name.trim(),
        address: worksiteForm.address?.trim() || undefined
      },
      {
        onSuccess: (created) => {
          setPendingWorksite({ id: created.id, code: created.code, name: created.name });
          setForm((prev) => ({ ...prev, worksiteIds: [created.id] }));
          setWorksiteForm(EMPTY_WORKSITE_FORM);
          setShowNewWorksite(false);
          setFeedback({ type: "success", message: "Punctul de lucru a fost creat și selectat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem || !editForm) return;
    setFeedback(null);
    updateLegalEntity.mutate(
      {
        id: editingItem.id,
        payload: {
          code: editForm.code?.trim(),
          name: editForm.name?.trim(),
          cui: editForm.cui?.trim() || null,
          headquarters: editForm.headquarters?.trim() || null,
          active: editForm.active
        }
      },
      {
        onSuccess: () => {
          closeEdit();
          setFeedback({ type: "success", message: "Entitatea juridică a fost actualizată." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onToggleActive = () => {
    if (!editingItem) return;
    setFeedback(null);
    const nextActive = !editingItem.active;
    updateLegalEntity.mutate(
      { id: editingItem.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          setEditingItem((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setEditForm((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setFeedback({
            type: "success",
            message: nextActive ? "Entitatea a fost activată." : "Entitatea a fost dezactivată."
          });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onDelete = () => {
    if (!editingItem) return;
    const confirmed = window.confirm(
      `Ștergi entitatea juridică „${editingItem.name}”? Această acțiune nu poate fi anulată.`
    );
    if (!confirmed) return;
    setFeedback(null);
    deleteLegalEntity.mutate(editingItem.id, {
      onSuccess: () => {
        closeEdit();
        setFeedback({ type: "success", message: "Entitatea juridică a fost ștearsă." });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const mutationPending = updateLegalEntity.isPending || deleteLegalEntity.isPending;

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Entități juridice</h2>
            <p className="comms-toolbar-hint">{paged.total} în total</p>
          </div>
          <button
            type="button"
            className="btn-primary comms-toolbar-cta"
            onClick={() => {
              setFeedback(null);
              setForm(EMPTY_FORM);
              setWorksiteForm(EMPTY_WORKSITE_FORM);
              setPendingWorksite(null);
              setShowNewWorksite(false);
              setShowForm(true);
            }}
          >
            {MASTER_DATA_ADD_LABELS["legal-entities"]}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-legal-entity-search">Caută</label>
            <input
              id="md-legal-entity-search"
              type="search"
              placeholder="Cod, denumire, CUI sau punct de lucru..."
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
                <th>CUI</th>
                <th>Sediu social</th>
                <th>Puncte de lucru</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={7} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="comms-empty-cell">
                    <p>Nu am găsit entități juridice{search ? " pentru căutare" : ""}.</p>
                  </td>
                </tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.cui || "—"}</td>
                  <td>{item.headquarters || "—"}</td>
                  <td>{formatWorksites(item)}</td>
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
          title="Entitate juridică nouă"
          titleId="md-legal-entity-create-title"
          description="Alege un punct de lucru existent sau creează unul nou, apoi salvează entitatea."
          onClose={() => setShowForm(false)}
        >
          <form className="form-stack" onSubmit={onSubmit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-legal-entity-code">Cod entitate *</label>
                <input
                  id="md-legal-entity-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Ex: E01"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-legal-entity-name">Denumire *</label>
                <input
                  id="md-legal-entity-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Firma SRL"
                  required
                />
              </div>
            </div>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-legal-entity-cui">CUI</label>
                <input
                  id="md-legal-entity-cui"
                  value={form.cui ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, cui: event.target.value }))}
                  placeholder="Ex: RO12345678"
                />
              </div>
              <div className="field">
                <label htmlFor="md-legal-entity-headquarters">Sediu social</label>
                <input
                  id="md-legal-entity-headquarters"
                  value={form.headquarters ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, headquarters: event.target.value }))}
                  placeholder="Oraș, adresă..."
                />
              </div>
            </div>

            <div className="comms-form-row">
              <FieldSelect
                id="md-legal-entity-worksite"
                label="Punct de lucru *"
                value={form.worksiteIds[0] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    worksiteIds: value.trim() ? [value.trim()] : []
                  }))
                }
                allowEmpty
                emptyLabel="Selectează punct de lucru"
                options={worksiteSelectOptions}
                hint={
                  worksitesLookup.isLoading
                    ? "Se încarcă punctele de lucru..."
                    : worksiteSelectOptions.length
                      ? "Alege din listă sau creează unul nou."
                      : "Nu există puncte de lucru. Creează unul nou mai jos."
                }
              />
              <div className="field">
                <label htmlFor="md-legal-entity-new-worksite-toggle">&nbsp;</label>
                <button
                  id="md-legal-entity-new-worksite-toggle"
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFeedback(null);
                    setShowNewWorksite((open) => !open);
                  }}
                >
                  {showNewWorksite ? "Ascunde" : " Adaugă Punct de lucru"}
                </button>
              </div>
            </div>

            {showNewWorksite ? (
              <div className="form-stack" style={{ gap: "0.75rem" }}>
                <div className="comms-form-row">
                  <div className="field">
                    <label htmlFor="md-legal-entity-worksite-code">Cod punct *</label>
                    <input
                      id="md-legal-entity-worksite-code"
                      value={worksiteForm.code}
                      onChange={(event) => setWorksiteForm((prev) => ({ ...prev, code: event.target.value }))}
                      placeholder="Ex: HQ"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="md-legal-entity-worksite-name">Denumire punct *</label>
                    <input
                      id="md-legal-entity-worksite-name"
                      value={worksiteForm.name}
                      onChange={(event) => setWorksiteForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Ex: Sediu central"
                    />
                  </div>
                </div>
                <div className="comms-form-row">
                  <div className="field">
                    <label htmlFor="md-legal-entity-worksite-address">Adresă</label>
                    <input
                      id="md-legal-entity-worksite-address"
                      value={worksiteForm.address ?? ""}
                      onChange={(event) => setWorksiteForm((prev) => ({ ...prev, address: event.target.value }))}
                      placeholder="Strada, oraș..."
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="md-legal-entity-worksite-create">&nbsp;</label>
                    <button
                      id="md-legal-entity-worksite-create"
                      type="button"
                      className="btn-primary"
                      disabled={
                        createWorksite.isPending || !worksiteForm.code.trim() || !worksiteForm.name.trim()
                      }
                      onClick={onCreateWorksite}
                    >
                      {createWorksite.isPending ? "Se creează..." : "Adaugă punctul"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createLegalEntity.isPending}>
                {createLegalEntity.isPending ? "Se salvează..." : "Salvează"}
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
          titleId="md-legal-entity-edit-title"
          description={`${editingItem.code}${editingItem.cui ? ` · ${editingItem.cui}` : ""}`}
          onClose={closeEdit}
        >
          <form className="form-stack" onSubmit={onSaveEdit}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-legal-entity-edit-code">Cod entitate *</label>
                <input
                  id="md-legal-entity-edit-code"
                  required
                  value={editForm.code ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-legal-entity-edit-name">Denumire *</label>
                <input
                  id="md-legal-entity-edit-name"
                  required
                  value={editForm.name ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-legal-entity-edit-cui">CUI</label>
                <input
                  id="md-legal-entity-edit-cui"
                  value={editForm.cui ?? ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, cui: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-legal-entity-edit-headquarters">Sediu social</label>
                <input
                  id="md-legal-entity-edit-headquarters"
                  value={editForm.headquarters ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, headquarters: event.target.value }))
                  }
                />
              </div>
            </div>
            <OptionCardRadioGroup
              name="md-legal-entity-edit-active"
              legend="Status"
              value={editForm.active ? "true" : "false"}
              onChange={(value) => setEditForm((prev) => ({ ...prev, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={mutationPending}>
                {updateLegalEntity.isPending ? "Se salvează…" : "Salvează modificările"}
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
                {deleteLegalEntity.isPending ? "Se șterge…" : "Șterge"}
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
