import { FormEvent, useMemo, useState } from "react";
import type { CreateWorksitePayload, WorksiteItem } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useCreateWorksite, useWorksites } from "../hooks/useMasterData";
import { MASTER_DATA_ADD_LABELS, MASTER_DATA_CLOSE_FORM_CTA, activeLabel, activeTone, mutationErrorMessage } from "../master-data-shared";

const EMPTY_FORM: CreateWorksitePayload = {
  code: "",
  name: "",
  address: "",
  active: true
};

export function MasterDataWorksitesPanel() {
  const pagination = usePagination();
  const query = useWorksites(pagination.params);
  const createWorksite = useCreateWorksite();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateWorksitePayload>(EMPTY_FORM);
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
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : MASTER_DATA_ADD_LABELS.worksites}
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
                <th>Adresă</th>
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
          <h3 className="card-title">Punct de lucru nou</h3>
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
      ) : null}
    </>
  );
}
