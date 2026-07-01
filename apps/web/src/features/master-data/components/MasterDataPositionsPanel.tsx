import { FormEvent, useMemo, useState } from "react";
import type { CreateJobPositionPayload, JobPositionItem } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useCreateJobPosition, useDepartmentsLookup, useJobPositions, useLegalEntitiesLookup, useWorksitesLookup } from "../hooks/useMasterData";
import { MASTER_DATA_ADD_LABELS, MASTER_DATA_CLOSE_FORM_CTA, activeLabel, activeTone, mutationErrorMessage } from "../master-data-shared";

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

export function MasterDataPositionsPanel() {
  const pagination = usePagination();
  const query = useJobPositions(pagination.params);
  const departmentsLookup = useDepartmentsLookup();
  const legalEntitiesLookup = useLegalEntitiesLookup();
  const worksitesLookup = useWorksitesLookup();
  const createJobPosition = useCreateJobPosition();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const departmentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of departmentsLookup.data?.items ?? []) {
      map.set(item.id, `${item.code} - ${item.name}`);
    }
    return map;
  }, [departmentsLookup.data?.items]);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateJobPositionPayload>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : MASTER_DATA_ADD_LABELS.positions}
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

        {feedback && !showForm ? (
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
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>{activeLabel(item.active)}</span>
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
        <form className="card form-stack comms-panel md-create-form" onSubmit={onSubmit}>
          <h3 className="card-title">Post nou</h3>
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
            options={mapToOptions(
              legalEntitiesLookup.data?.items ?? [],
              (entity) => entity.id,
              (entity) => `${entity.code} - ${entity.name}`
            )}
          />
          <FieldSelect
            id="md-job-worksite"
            label="Punct de lucru"
            value={form.worksiteId ?? ""}
            onChange={(worksiteId) => setForm((prev) => ({ ...prev, worksiteId }))}
            allowEmpty
            emptyLabel="Neselectat"
            options={mapToOptions(
              worksitesLookup.data?.items ?? [],
              (worksite) => worksite.id,
              (worksite) => `${worksite.code} - ${worksite.name}`
            )}
          />
          <FieldSelect
            id="md-job-department"
            label="Departament (opțional)"
            value={form.departmentId ?? ""}
            onChange={(departmentId) => setForm((prev) => ({ ...prev, departmentId }))}
            allowEmpty
            emptyLabel="Neselectat"
            options={mapToOptions(
              departmentsLookup.data?.items ?? [],
              (department) => department.id,
              (department) => `${department.code} - ${department.name}`
            )}
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
      ) : null}
    </>
  );
}
