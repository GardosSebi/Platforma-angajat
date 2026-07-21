import { FormEvent, useMemo, useState } from "react";
import type { CreateDepartmentPayload, DepartmentItem } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useCreateDepartment, useDepartments, useWorksitesLookup } from "../hooks/useMasterData";
import { MASTER_DATA_ADD_LABELS, activeLabel, activeTone, mutationErrorMessage } from "../master-data-shared";
import { MasterDataCreateModal } from "./MasterDataCreateModal";

const EMPTY_FORM: CreateDepartmentPayload = {
  code: "",
  name: "",
  worksiteId: "",
  active: true
};

export function MasterDataDepartmentsPanel() {
  const pagination = usePagination();
  const query = useDepartments(pagination.params);
  const worksitesLookup = useWorksitesLookup();
  const createDepartment = useCreateDepartment();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const worksiteById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of worksitesLookup.data?.items ?? []) {
      map.set(item.id, `${item.code} - ${item.name}`);
    }
    return map;
  }, [worksitesLookup.data?.items]);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDepartmentPayload>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const items = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return paged.items;
    return paged.items.filter(
      (item) => item.code.toLowerCase().includes(queryText) || item.name.toLowerCase().includes(queryText)
    );
  }, [paged.items, search]);

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
                <th>Punct de lucru</th>
                <th>Stare</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="comms-empty-cell">
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
              options={mapToOptions(
                worksitesLookup.data?.items ?? [],
                (worksite) => worksite.id,
                (worksite) => `${worksite.code} - ${worksite.name}`
              )}
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
    </>
  );
}
