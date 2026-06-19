import type { SurveyItem } from "@repo/shared-types/surveys";
import { PaginationBar } from "../../../shared/components/PaginationBar";
import {
  AUDIENCE_LABELS,
  SURVEY_STATUS_LABELS,
  formatSurveyDate,
  surveyStatusTone
} from "../surveys-shared";

type Props = {
  items: SurveyItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  statusFilter: string;
  selectedId: string;
  canComplete: boolean;
  respondedIds: Set<string>;
  openingSurveyId: string | null;
  feedback: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelect: (id: string) => void;
  onManage: (id: string) => void;
  onCreateClick: () => void;
  onComplete: (id: string) => void;
};

const STATUS_FILTERS = [
  { value: "", label: "Toate" },
  { value: "DRAFT", label: "Ciorne" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Închise" },
  { value: "ARCHIVED", label: "Arhivate" }
] as const;

export function SurveyListPanel({
  items,
  total,
  page,
  pageSize,
  totalPages,
  isLoading,
  isFetching,
  search,
  statusFilter,
  selectedId,
  canComplete,
  respondedIds,
  openingSurveyId,
  feedback,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onPageSizeChange,
  onSelect,
  onManage,
  onCreateClick,
  onComplete
}: Props) {
  return (
    <section className="card comms-panel">
      <div className="comms-toolbar">
        <div className="comms-toolbar-start">
          <h2 className="card-title">Sondaje</h2>
          <p className="comms-toolbar-hint">{total} în total · click pe rând pentru a gestiona</p>
        </div>
        <button type="button" className="btn-primary comms-toolbar-cta" onClick={onCreateClick}>
          + Sondaj nou
        </button>
      </div>

      <div className="comms-filters">
        <div className="field comms-search-field">
          <label htmlFor="survey-search">Caută</label>
          <input
            id="survey-search"
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
        <div className="feedback error" role="alert">
          {feedback}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table comms-table">
          <thead>
            <tr>
              <th>Titlu</th>
              <th>Stare</th>
              <th>Destinatari</th>
              <th>Întrebări</th>
              <th>Răspunsuri</th>
              <th>Actualizat</th>
              <th aria-label="Acțiuni" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-muted">
                  Se încarcă sondajele...
                </td>
              </tr>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="comms-empty-cell">
                  <p>Nu am găsit sondaje{search || statusFilter ? " pentru filtrele alese" : ""}.</p>
                  {!search && !statusFilter ? (
                    <button type="button" className="btn-primary" onClick={onCreateClick}>
                      Creează primul sondaj
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {items.map((survey) => {
              const completed = respondedIds.has(survey.id);
              const canRespond =
                canComplete &&
                !completed &&
                survey.status !== "CLOSED" &&
                survey.status !== "ARCHIVED";
              return (
                <tr
                  key={survey.id}
                  className={`comms-row${selectedId === survey.id ? " selected" : ""}`}
                  onClick={() => onSelect(survey.id)}
                >
                  <td className="comms-title-cell">{survey.title}</td>
                  <td>
                    <span className={`comms-status comms-status--${surveyStatusTone(survey.status)}`}>
                      {SURVEY_STATUS_LABELS[survey.status]}
                    </span>
                  </td>
                  <td>{AUDIENCE_LABELS[survey.audienceType]}</td>
                  <td>{survey.stats.questionCount}</td>
                  <td>{survey.stats.responseCount}</td>
                  <td>{formatSurveyDate(survey.updatedAt)}</td>
                  <td className="comms-actions-cell" onClick={(event) => event.stopPropagation()}>
                    <div className="comms-row-actions">
                      {canRespond ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={openingSurveyId === survey.id}
                          onClick={() => onComplete(survey.id)}
                        >
                          {openingSurveyId === survey.id ? "Se pregătește…" : "Completează"}
                        </button>
                      ) : null}
                      {canComplete && completed ? <span className="comms-status comms-status--good">Completat</span> : null}
                      <button type="button" className="btn-secondary btn-sm" onClick={() => onManage(survey.id)}>
                        Gestionează
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
