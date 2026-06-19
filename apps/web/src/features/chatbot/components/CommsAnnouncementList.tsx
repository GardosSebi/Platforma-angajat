import type { CommunicationAnnouncementItem } from "@repo/shared-types/communications";
import { PaginationBar } from "../../../shared/components/PaginationBar";
import { AUDIENCE_LABELS, STATUS_LABELS, formatCommsDate, statusTone } from "../comms-shared";

type Props = {
  items: CommunicationAnnouncementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  canEdit: boolean;
  search: string;
  statusFilter: string;
  selectedId: string;
  feedback: { type: "success" | "error"; message: string } | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelect: (id: string) => void;
  onCreateClick: () => void;
  onPublish: (id: string) => void;
  onRetract: (id: string) => void;
  onDuplicate: (id: string) => void;
};

const STATUS_FILTERS = [
  { value: "", label: "Toate" },
  { value: "DRAFT", label: "Ciorne" },
  { value: "PUBLISHED", label: "Publicate" },
  { value: "SCHEDULED", label: "Programate" },
  { value: "RETRACTED", label: "Retrase" }
] as const;

export function CommsAnnouncementList({
  items,
  total,
  page,
  pageSize,
  totalPages,
  isLoading,
  isFetching,
  canEdit,
  search,
  statusFilter,
  selectedId,
  feedback,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onPageSizeChange,
  onSelect,
  onCreateClick,
  onPublish,
  onRetract,
  onDuplicate
}: Props) {
  return (
    <section className="card comms-panel">
      <div className="comms-toolbar">
        <div className="comms-toolbar-start">
          <h2 className="card-title">Anunțuri</h2>
          <p className="comms-toolbar-hint">{total} în total · click pe rând pentru detalii</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn-primary comms-toolbar-cta" onClick={onCreateClick}>
            + Anunț nou
          </button>
        ) : null}
      </div>

      <div className="comms-filters">
        <div className="field comms-search-field">
          <label htmlFor="comms-search">Caută</label>
          <input
            id="comms-search"
            type="search"
            placeholder="Titlu sau destinatari..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="comms-status-filters" role="group" aria-label="Filtrează după stare">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || "all"}
              type="button"
              className={`comms-filter-chip${statusFilter === filter.value ? " active" : ""}`}
              onClick={() => onStatusFilterChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table comms-table">
          <thead>
            <tr>
              <th>Titlu</th>
              <th>Stare</th>
              <th>Destinatari</th>
              <th>Citire</th>
              <th>Publicat</th>
              {canEdit ? <th aria-label="Acțiuni" /> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="text-muted">
                  Se încarcă anunțurile...
                </td>
              </tr>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="comms-empty-cell">
                  <p>Nu am găsit anunțuri{search || statusFilter ? " pentru filtrele alese" : ""}.</p>
                  {canEdit && !search && !statusFilter ? (
                    <button type="button" className="btn-primary" onClick={onCreateClick}>
                      Creează primul anunț
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {items.map((item) => (
              <tr
                key={item.id}
                className={`comms-row${selectedId === item.id ? " selected" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                <td className="comms-title-cell">{item.title}</td>
                <td>
                  <span className={`comms-status comms-status--${statusTone(item.status)}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td>{AUDIENCE_LABELS[item.audienceType]}</td>
                <td>
                  <span className="comms-read-rate">{item.stats.readRate}%</span>
                  <span className="comms-read-count text-muted small">
                    ({item.stats.readCount}/{item.stats.targetCount})
                  </span>
                </td>
                <td>{formatCommsDate(item.publishAt ?? item.createdAt)}</td>
                {canEdit ? (
                  <td className="comms-row-menu" onClick={(event) => event.stopPropagation()}>
                    <details className="comms-actions-menu">
                      <summary aria-label={`Acțiuni pentru ${item.title}`}>⋯</summary>
                      <div className="comms-actions-dropdown">
                        <button type="button" onClick={() => onSelect(item.id)}>
                          Vezi detalii
                        </button>
                        {item.status === "DRAFT" || item.status === "SCHEDULED" ? (
                          <button type="button" onClick={() => onPublish(item.id)}>
                            Publică acum
                          </button>
                        ) : null}
                        {item.status === "PUBLISHED" ? (
                          <button type="button" onClick={() => onRetract(item.id)}>
                            Retrage
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onDuplicate(item.id)}>
                          Duplică
                        </button>
                      </div>
                    </details>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        disabled={isFetching}
      />
    </section>
  );
}
