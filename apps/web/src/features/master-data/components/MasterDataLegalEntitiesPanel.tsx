import { FormEvent, useMemo, useState } from "react";
import type { CreateLegalEntityPayload } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useCreateLegalEntity, useLegalEntities, useWorksitesLookup } from "../hooks/useMasterData";
import type { LegalEntityItem } from "../master-data-shared";
import { MASTER_DATA_ADD_LABELS, MASTER_DATA_CLOSE_FORM_CTA, activeLabel, activeTone, mutationErrorMessage } from "../master-data-shared";

const EMPTY_FORM: CreateLegalEntityPayload = {
  code: "",
  name: "",
  cui: "",
  headquarters: "",
  worksiteIds: []
};

function formatWorksites(item: LegalEntityItem): string {
  if (!item.worksites?.length) return "—";
  return item.worksites.map((worksite) => `${worksite.code} — ${worksite.name}`).join(", ");
}

export function MasterDataLegalEntitiesPanel() {
  const pagination = usePagination();
  const query = useLegalEntities(pagination.params);
  const worksitesLookup = useWorksitesLookup();
  const createLegalEntity = useCreateLegalEntity();
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateLegalEntityPayload>(EMPTY_FORM);
  const [selectedWorksiteId, setSelectedWorksiteId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const worksiteOptions = useMemo(() => {
    const items = worksitesLookup.data?.items ?? [];
    return mapToOptions(
      items,
      (worksite) => worksite.id,
      (worksite) => {
        const assigned = worksite.legalEntityId ? " (altă entitate)" : "";
        return `${worksite.code} — ${worksite.name}${assigned}`;
      }
    );
  }, [worksitesLookup.data?.items]);

  const availableWorksiteOptions = useMemo(
    () =>
      worksiteOptions.filter(
        (option) =>
          !form.worksiteIds.includes(option.value) &&
          !(worksitesLookup.data?.items ?? []).find((item) => item.id === option.value)?.legalEntityId
      ),
    [form.worksiteIds, worksiteOptions, worksitesLookup.data?.items]
  );

  const selectedWorksites = useMemo(() => {
    const byId = new Map((worksitesLookup.data?.items ?? []).map((item) => [item.id, item]));
    return form.worksiteIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [form.worksiteIds, worksitesLookup.data?.items]);

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

  const addWorksite = () => {
    if (!selectedWorksiteId || form.worksiteIds.includes(selectedWorksiteId)) return;
    setForm((prev) => ({ ...prev, worksiteIds: [...prev.worksiteIds, selectedWorksiteId] }));
    setSelectedWorksiteId("");
  };

  const removeWorksite = (worksiteId: string) => {
    setForm((prev) => ({ ...prev, worksiteIds: prev.worksiteIds.filter((id) => id !== worksiteId) }));
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
          setSelectedWorksiteId("");
          setShowForm(false);
          setFeedback({ type: "success", message: "Entitatea juridică a fost adăugată." });
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
            <h2 className="card-title">Entități juridice</h2>
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
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : MASTER_DATA_ADD_LABELS["legal-entities"]}
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
                <th>CUI</th>
                <th>Sediu social</th>
                <th>Puncte de lucru</th>
                <th>Stare</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="comms-empty-cell">
                    <p>Nu am găsit entități juridice{search ? " pentru căutare" : ""}.</p>
                    {!search ? (
                      <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                        Adaugă prima entitate juridică
                      </button>
                    ) : null}
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
          <h3 className="card-title">Entitate juridică nouă</h3>
          <p className="comms-toolbar-hint">Asociază entitatea cu unul sau mai multe puncte de lucru existente.</p>

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
              value={selectedWorksiteId}
              onChange={setSelectedWorksiteId}
              allowEmpty
              emptyLabel="Selectează punct de lucru"
              options={availableWorksiteOptions}
              hint={
                worksitesLookup.isLoading
                  ? "Se încarcă punctele de lucru..."
                  : availableWorksiteOptions.length
                    ? "Alege un punct de lucru și apasă Adaugă."
                    : "Nu există puncte de lucru disponibile. Creează-le din tab-ul Puncte de lucru."
              }
            />
            <div className="field">
              <label htmlFor="md-legal-entity-add-worksite">&nbsp;</label>
              <button
                id="md-legal-entity-add-worksite"
                type="button"
                className="btn-secondary"
                onClick={addWorksite}
                disabled={!selectedWorksiteId}
              >
                Adaugă
              </button>
            </div>
          </div>

          {selectedWorksites.length ? (
            <ul className="data-list">
              {selectedWorksites.map((worksite) => (
                <li key={worksite.id}>
                  <strong>{worksite.code}</strong> — {worksite.name}
                  <button type="button" className="btn-text" onClick={() => removeWorksite(worksite.id)}>
                    Elimină
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">Niciun punct de lucru selectat încă.</p>
          )}

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
      ) : null}
    </>
  );
}
