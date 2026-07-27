import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmResponsiblePayload,
  SsmResponsibleItem,
  UpdateSsmResponsiblePayload
} from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useCreateSsmResponsible,
  useLegalEntitiesLookup,
  useSsmResponsibles,
  useUpdateSsmResponsible,
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

const TYPE_OPTIONS = [
  { value: "DESIGNATED_WORKER", label: "Lucrător desemnat" },
  { value: "EXTERNAL_SERVICE", label: "Serviciu extern SSM" }
] as const;

const EMPTY_FORM: CreateSsmResponsiblePayload = {
  type: "DESIGNATED_WORKER",
  personName: "",
  email: "",
  phone: "",
  notes: "",
  active: true
};

function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function toEditForm(item: SsmResponsibleItem): UpdateSsmResponsiblePayload {
  return {
    type: item.type,
    personName: item.personName,
    email: item.email ?? "",
    phone: item.phone ?? "",
    notes: item.notes ?? "",
    legalEntityId: item.legalEntityId ?? undefined,
    worksiteId: item.worksiteId ?? undefined,
    active: item.active
  };
}

export function MasterDataSsmResponsiblesPanel() {
  const pagination = usePagination();
  const query = useSsmResponsibles(pagination.params);
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);
  const worksites = useWorksitesLookup();
  const legalEntities = useLegalEntitiesLookup();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateSsmResponsiblePayload>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateSsmResponsiblePayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const createResponsible = useCreateSsmResponsible();
  const updateResponsible = useUpdateSsmResponsible();

  const selected = useMemo(
    () => paged.items.find((item) => item.id === selectedId) ?? null,
    [paged.items, selectedId]
  );

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter((item) => {
      const haystack = [
        item.personName,
        typeLabel(item.type),
        item.email ?? "",
        item.phone ?? "",
        item.legalEntity?.name ?? "",
        item.legalEntity?.code ?? "",
        item.worksite?.name ?? "",
        item.worksite?.code ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(queryText);
    });
  }, [paged.items, search]);

  useEffect(() => {
    if (!selectedId || query.isFetching) return;
    if (!paged.items.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setEditForm(null);
    }
  }, [paged.items, selectedId, query.isFetching]);

  const openDetails = (item: SsmResponsibleItem) => {
    setFeedback(null);
    setSelectedId(item.id);
    setEditForm(toEditForm(item));
  };

  const closeDetails = () => {
    setSelectedId(null);
    setEditForm(null);
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    createResponsible.mutate(
      {
        ...form,
        personName: form.personName.trim(),
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        legalEntityId: form.legalEntityId || undefined,
        worksiteId: form.worksiteId || undefined
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
          setFeedback({ type: "success", message: "Responsabil SSM adăugat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !editForm) return;
    setFeedback(null);
    updateResponsible.mutate(
      {
        id: selectedId,
        payload: {
          type: editForm.type,
          personName: editForm.personName?.trim(),
          email: editForm.email?.trim() || null,
          phone: editForm.phone?.trim() || null,
          notes: editForm.notes?.trim() || null,
          legalEntityId: editForm.legalEntityId || null,
          worksiteId: editForm.worksiteId || null,
          active: editForm.active
        }
      },
      {
        onSuccess: () => {
          closeDetails();
          setFeedback({ type: "success", message: "Responsabilul SSM a fost actualizat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onToggleActive = () => {
    if (!selected) return;
    setFeedback(null);
    const nextActive = !selected.active;
    updateResponsible.mutate(
      { id: selected.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          setEditForm((prev) => (prev ? { ...prev, active: nextActive } : prev));
          setFeedback({
            type: "success",
            message: nextActive ? "Responsabilul a fost activat." : "Responsabilul a fost dezactivat."
          });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const legalEntityOptions = mapToOptions(
    legalEntities.data?.items ?? [],
    (entity) => entity.id,
    (entity) => `${entity.code} — ${entity.name}`
  );
  const worksiteOptions = mapToOptions(
    worksites.data?.items ?? [],
    (worksite) => worksite.id,
    (worksite) => `${worksite.code} — ${worksite.name}`
  );
  const typeSelectOptions = TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Responsabili SSM</h2>
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
            {MASTER_DATA_ADD_LABELS["ssm-responsibles"]}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-ssm-responsible-search">Caută</label>
            <input
              id="md-ssm-responsible-search"
              type="search"
              placeholder="Nume, tip, entitate, punct de lucru..."
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
                <th>Nume</th>
                <th>Tip</th>
                <th>Entitate</th>
                <th>Punct de lucru</th>
                <th>Contact</th>
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
                    <p>Nu am găsit responsabili SSM{search ? " pentru căutare" : ""}.</p>
                    {!search ? (
                      <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                        Adaugă primul responsabil SSM
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.personName}</td>
                  <td>{typeLabel(item.type)}</td>
                  <td>
                    {item.legalEntity ? `${item.legalEntity.code} — ${item.legalEntity.name}` : "—"}
                  </td>
                  <td>{item.worksite ? `${item.worksite.code} — ${item.worksite.name}` : "—"}</td>
                  <td>
                    {[item.email, item.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
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
          title="Responsabil SSM nou"
          titleId="md-ssm-responsible-create-title"
          description="Completează datele responsabilului și asociază-l opțional la o entitate sau un punct de lucru."
          onClose={() => setShowForm(false)}
          size="wide"
        >
          <form className="form-stack" onSubmit={onCreate}>
            <div className="comms-form-row">
              <FieldSelect
                id="ssm-responsible-type"
                label="Tip responsabil *"
                value={form.type}
                onChange={(value) => setForm((f) => ({ ...f, type: value as CreateSsmResponsiblePayload["type"] }))}
                options={typeSelectOptions}
              />
              <div className="field">
                <label htmlFor="ssm-responsible-name">Nume persoană / firmă *</label>
                <input
                  id="ssm-responsible-name"
                  required
                  value={form.personName}
                  onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                  placeholder="Ex: Popescu Ion"
                />
              </div>
            </div>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="ssm-responsible-email">Email</label>
                <input
                  id="ssm-responsible-email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@companie.ro"
                />
              </div>
              <div className="field">
                <label htmlFor="ssm-responsible-phone">Telefon</label>
                <input
                  id="ssm-responsible-phone"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="07xx xxx xxx"
                />
              </div>
            </div>
            <div className="comms-form-row">
              <FieldSelect
                id="ssm-responsible-entity"
                label="Entitate juridică"
                value={form.legalEntityId ?? ""}
                onChange={(value) => setForm((f) => ({ ...f, legalEntityId: value || undefined }))}
                options={legalEntityOptions}
                allowEmpty
                emptyLabel="—"
              />
              <FieldSelect
                id="ssm-responsible-worksite"
                label="Punct de lucru"
                value={form.worksiteId ?? ""}
                onChange={(value) => setForm((f) => ({ ...f, worksiteId: value || undefined }))}
                options={worksiteOptions}
                allowEmpty
                emptyLabel="—"
              />
            </div>
            <div className="field">
              <label htmlFor="ssm-responsible-notes">Note</label>
              <textarea
                id="ssm-responsible-notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observații opționale..."
              />
            </div>
            <OptionCardRadioGroup
              name="ssm-responsible-active"
              legend="Status"
              value={form.active ? "true" : "false"}
              onChange={(value) => setForm((f) => ({ ...f, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={createResponsible.isPending}>
                {createResponsible.isPending ? "Se salvează…" : "Salvează"}
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
          title={`Editează: ${selected.personName}`}
          titleId="md-ssm-responsible-edit-title"
          description={typeLabel(selected.type)}
          onClose={closeDetails}
          size="wide"
        >
          <form className="form-stack" onSubmit={onSaveEdit}>
            <div className="comms-form-row">
              <FieldSelect
                id="ssm-responsible-edit-type"
                label="Tip responsabil *"
                value={editForm.type ?? "DESIGNATED_WORKER"}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, type: value as CreateSsmResponsiblePayload["type"] }))
                }
                options={typeSelectOptions}
              />
              <div className="field">
                <label htmlFor="ssm-responsible-edit-name">Nume persoană / firmă *</label>
                <input
                  id="ssm-responsible-edit-name"
                  required
                  value={editForm.personName ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, personName: e.target.value }))}
                />
              </div>
            </div>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="ssm-responsible-edit-email">Email</label>
                <input
                  id="ssm-responsible-edit-email"
                  type="email"
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="ssm-responsible-edit-phone">Telefon</label>
                <input
                  id="ssm-responsible-edit-phone"
                  value={editForm.phone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="comms-form-row">
              <FieldSelect
                id="ssm-responsible-edit-entity"
                label="Entitate juridică"
                value={editForm.legalEntityId ?? ""}
                onChange={(value) => setEditForm((f) => ({ ...f, legalEntityId: value || undefined }))}
                options={legalEntityOptions}
                allowEmpty
                emptyLabel="—"
              />
              <FieldSelect
                id="ssm-responsible-edit-worksite"
                label="Punct de lucru"
                value={editForm.worksiteId ?? ""}
                onChange={(value) => setEditForm((f) => ({ ...f, worksiteId: value || undefined }))}
                options={worksiteOptions}
                allowEmpty
                emptyLabel="—"
              />
            </div>
            <div className="field">
              <label htmlFor="ssm-responsible-edit-notes">Note</label>
              <textarea
                id="ssm-responsible-edit-notes"
                value={editForm.notes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <OptionCardRadioGroup
              name="ssm-responsible-edit-active"
              legend="Status"
              value={editForm.active ? "true" : "false"}
              onChange={(value) => setEditForm((f) => ({ ...f, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="comms-compose-actions">
              <button type="submit" className="btn-primary" disabled={updateResponsible.isPending}>
                {updateResponsible.isPending ? "Se salvează…" : "Salvează modificările"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={updateResponsible.isPending}
                onClick={onToggleActive}
              >
                {selected.active ? "Dezactivează" : "Activează"}
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
