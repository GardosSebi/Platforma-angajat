import { FormEvent, useState } from "react";
import type { CreateSsmResponsiblePayload, SsmResponsibleItem } from "../api/master-data.api";
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
  MASTER_DATA_CLOSE_FORM_CTA,
  activeLabel,
  activeTone,
  mutationErrorMessage
} from "../master-data-shared";

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

export function MasterDataSsmResponsiblesPanel() {
  const pagination = usePagination();
  const query = useSsmResponsibles(pagination.params);
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);
  const worksites = useWorksitesLookup();
  const legalEntities = useLegalEntitiesLookup();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateSsmResponsiblePayload>(EMPTY_FORM);
  const [selected, setSelected] = useState<SsmResponsibleItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const createResponsible = useCreateSsmResponsible();
  const updateResponsible = useUpdateSsmResponsible();

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

  const onToggleActive = (item: SsmResponsibleItem) => {
    updateResponsible.mutate(
      { id: item.id, payload: { active: !item.active } },
      {
        onSuccess: () => setFeedback({ type: "success", message: "Status actualizat." }),
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Responsabili SSM</h2>
            <p className="comms-toolbar-hint">{paged.total} în total</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : "Adaugă responsabil SSM"}
          </button>
        </div>

        {feedback ? (
          <p className={`feedback ${feedback.type}`} role="status">
            {feedback.message}
          </p>
        ) : null}

        {showForm ? (
          <form className="master-data-form-grid" onSubmit={onCreate}>
            <FieldSelect
              id="ssm-responsible-type"
              label="Tip responsabil"
              value={form.type}
              onChange={(value) => setForm((f) => ({ ...f, type: value as CreateSsmResponsiblePayload["type"] }))}
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <label>
              Nume persoană / firmă
              <input
                required
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
              />
            </label>
            <label>
              Email
              <input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label>
              Telefon
              <input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <FieldSelect
              id="ssm-responsible-entity"
              label="Entitate juridică (opțional)"
              value={form.legalEntityId ?? ""}
              onChange={(value) => setForm((f) => ({ ...f, legalEntityId: value || undefined }))}
              options={mapToOptions(legalEntities.data?.items ?? [], (e) => e.id, (e) => `${e.code} — ${e.name}`)}
              allowEmpty
              emptyLabel="—"
            />
            <FieldSelect
              id="ssm-responsible-worksite"
              label="Punct de lucru (opțional)"
              value={form.worksiteId ?? ""}
              onChange={(value) => setForm((f) => ({ ...f, worksiteId: value || undefined }))}
              options={mapToOptions(worksites.data?.items ?? [], (w) => w.id, (w) => `${w.code} — ${w.name}`)}
              allowEmpty
              emptyLabel="—"
            />
            <label className="span-2">
              Note
              <textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </label>
            <OptionCardRadioGroup
              name="ssm-responsible-active"
              legend="Status"
              value={form.active ? "true" : "false"}
              onChange={(value) => setForm((f) => ({ ...f, active: value === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <div className="master-data-form-actions span-2">
              <button type="submit" className="btn-primary" disabled={createResponsible.isPending}>
                {createResponsible.isPending ? "Se salvează…" : MASTER_DATA_ADD_LABELS["ssm-responsibles"]}
              </button>
            </div>
          </form>
        ) : null}

        <div className="data-list-wrap">
          <ul className="data-list">
            {paged.items.map((item) => (
              <li key={item.id}>
                <button type="button" className="data-list-row" onClick={() => setSelected(item)}>
                  <strong>{item.personName}</strong>
                  <span>
                    {TYPE_OPTIONS.find((o) => o.value === item.type)?.label ?? item.type}
                    {item.legalEntity ? ` · ${item.legalEntity.name}` : ""}
                    {item.worksite ? ` · ${item.worksite.name}` : ""}
                  </span>
                  <span className={`status-chip ${activeTone(item.active)}`}>{activeLabel(item.active)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
        />
      </section>

      {selected ? (
        <section className="card comms-panel">
          <h3 className="card-title">Detalii responsabil</h3>
          <p>
            <strong>{selected.personName}</strong> — {TYPE_OPTIONS.find((o) => o.value === selected.type)?.label}
          </p>
          <p className="field-hint">
            {selected.email ?? "—"} · {selected.phone ?? "—"}
          </p>
          <div className="ssm-inline-actions">
            <button type="button" className="btn-secondary" onClick={() => onToggleActive(selected)}>
              {selected.active ? "Dezactivează" : "Activează"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
              Închide
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
