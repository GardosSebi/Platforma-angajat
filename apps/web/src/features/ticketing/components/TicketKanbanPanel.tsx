import type { DragEvent } from "react";
import type { HelpdeskTicketItem, HelpdeskTicketPriority, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { HELPDESK_TICKET_PRIORITIES } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import type { TicketFilters } from "../api/ticketing.api";
import {
  formatTicketDate,
  PRIORITY_LABELS,
  priorityTone,
  STATUSES,
  STATUS_LABELS,
  statusTone,
  type TicketViewMode
} from "../ticketing-shared";

type EmployeeOption = { id: string; fullName: string };

type Column = { status: HelpdeskTicketStatus; tickets: HelpdeskTicketItem[] };

type Props = {
  columns: Column[];
  filters: TicketFilters;
  viewMode: TicketViewMode;
  isLoading: boolean;
  draggedTicketId: string | null;
  dragOverStatus: HelpdeskTicketStatus | null;
  openedTicketId: string;
  employees: EmployeeOption[];
  onViewModeChange: (mode: TicketViewMode) => void;
  onFiltersChange: (patch: Partial<TicketFilters>) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
  onOpenTicket: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, ticket: HelpdeskTicketItem) => void;
  onDragEnd: () => void;
  onColumnDragOver: (event: DragEvent<HTMLDivElement>, status: HelpdeskTicketStatus) => void;
  onColumnDragLeave: () => void;
  onColumnDrop: (event: DragEvent<HTMLDivElement>, status: HelpdeskTicketStatus) => void;
};

const STATUS_FILTERS = [{ value: "", label: "Toate" }, ...STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))];
const PRIORITY_FILTERS = [
  { value: "", label: "Toate" },
  ...HELPDESK_TICKET_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))
];

export function TicketKanbanPanel({
  columns,
  filters,
  viewMode,
  isLoading,
  draggedTicketId,
  dragOverStatus,
  openedTicketId,
  employees,
  onViewModeChange,
  onFiltersChange,
  onClearFilters,
  onCreateClick,
  onOpenTicket,
  onDragStart,
  onDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop
}: Props) {
  const allTickets = columns.flatMap((column) => column.tickets);
  const hasActiveFilters = Boolean(
    filters.subject ||
      filters.search ||
      filters.status ||
      filters.priority ||
      filters.assignedToUserId ||
      filters.assignedToName ||
      filters.reporterEmployeeId ||
      filters.category
  );

  return (
    <section className="card comms-panel ticket-board-panel">
      <div className="comms-toolbar">
        <div className="comms-toolbar-start">
          <h2 className="card-title">Board tichete</h2>
          <p className="comms-toolbar-hint">Trage cardurile între coloane sau deschide un tichet pentru detalii.</p>
        </div>
        <button type="button" className="btn-primary comms-toolbar-cta" onClick={onCreateClick}>
          + Tichet nou
        </button>
      </div>

      <div className="comms-filters">
        <div className="field comms-search-field">
          <label htmlFor="ticket-search">Caută</label>
          <input
            id="ticket-search"
            type="search"
            placeholder="Titlu sau descriere..."
            value={filters.search ?? filters.subject ?? ""}
            onChange={(event) =>
              onFiltersChange({
                search: event.target.value || undefined,
                subject: event.target.value || undefined
              })
            }
          />
        </div>
        <div className="comms-status-filters" role="group" aria-label="Filtrează după stare">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || "all-status"}
              type="button"
              className={`comms-filter-chip${(filters.status ?? "") === filter.value ? " active" : ""}`}
              onClick={() => onFiltersChange({ status: (filter.value as HelpdeskTicketStatus) || undefined })}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="comms-status-filters" role="group" aria-label="Filtrează după prioritate">
          {PRIORITY_FILTERS.map((filter) => (
            <button
              key={filter.value || "all-priority"}
              type="button"
              className={`comms-filter-chip${(filters.priority ?? "") === filter.value ? " active" : ""}`}
              onClick={() => onFiltersChange({ priority: (filter.value as HelpdeskTicketPriority) || undefined })}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <details className="comms-advanced ticket-advanced-filters">
        <summary>Filtre avansate</summary>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="filter-recipient-name">Destinatar (nume operator)</label>
            <input
              id="filter-recipient-name"
              value={filters.assignedToName ?? ""}
              onChange={(event) => onFiltersChange({ assignedToName: event.target.value || undefined })}
              placeholder="Nume operator"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-operator">Operator (ID user)</label>
            <input
              id="filter-operator"
              value={filters.assignedToUserId ?? ""}
              onChange={(event) => onFiltersChange({ assignedToUserId: event.target.value || undefined })}
              placeholder="userId"
            />
          </div>
          <FieldSelect
            id="filter-reporter"
            label="Solicitant"
            value={filters.reporterEmployeeId ?? ""}
            onChange={(reporterEmployeeId) => onFiltersChange({ reporterEmployeeId: reporterEmployeeId || undefined })}
            allowEmpty
            emptyLabel="Toți"
            options={mapToOptions(
              employees,
              (employee) => employee.id,
              (employee) => employee.fullName
            )}
          />
          <div className="field">
            <label htmlFor="filter-category">Categorie</label>
            <input
              id="filter-category"
              value={filters.category ?? ""}
              onChange={(event) => onFiltersChange({ category: event.target.value || undefined })}
              placeholder="HR, IT..."
            />
          </div>
        </div>
        {hasActiveFilters ? (
          <button type="button" className="btn-secondary btn-sm" onClick={onClearFilters}>
            Resetează filtrele
          </button>
        ) : null}
      </details>

      <div className="ticket-view-toggle" role="group" aria-label="Mod afișare">
        <button
          type="button"
          className={`comms-filter-chip${viewMode === "kanban" ? " active" : ""}`}
          onClick={() => onViewModeChange("kanban")}
        >
          Kanban
        </button>
        <button
          type="button"
          className={`comms-filter-chip${viewMode === "list" ? " active" : ""}`}
          onClick={() => onViewModeChange("list")}
        >
          Listă
        </button>
      </div>

      {isLoading ? <p className="field-hint">Se încarcă tichetele...</p> : null}

      {!isLoading && viewMode === "kanban" ? (
        <div className="ticket-kanban-board" aria-label="Kanban helpdesk">
          {columns.map((column) => (
            <div
              key={column.status}
              className={`ticket-kanban-column ${dragOverStatus === column.status ? "drop-target" : ""}`}
              onDragOver={(event) => onColumnDragOver(event, column.status)}
              onDragLeave={onColumnDragLeave}
              onDrop={(event) => onColumnDrop(event, column.status)}
            >
              <div className="ticket-kanban-column-head">
                <strong>{STATUS_LABELS[column.status]}</strong>
                <span>{column.tickets.length}</span>
              </div>
              <div className="ticket-kanban-cards">
                {column.tickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className={`ticket-kanban-card ${draggedTicketId === ticket.id ? "dragging" : ""} ${openedTicketId === ticket.id ? "selected" : ""}`}
                    draggable
                    onDragStart={(event) => onDragStart(event, ticket)}
                    onDragEnd={onDragEnd}
                    onClick={() => onOpenTicket(ticket.id)}
                  >
                    <strong>{ticket.title}</strong>
                    <span className="ticket-card-subtitle">
                      {ticket.category ?? "General"} · {formatTicketDate(ticket.dueAt)}
                    </span>
                    <div className="ticket-card-meta">
                      <span className={`comms-status comms-status--${priorityTone(ticket.priority)}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                      <span className="comms-status comms-status--warn">
                        {ticket.assignedToName || ticket.assignedToUserId || "Neasignat"}
                      </span>
                    </div>
                  </article>
                ))}
                {!column.tickets.length ? <p className="field-hint ticket-kanban-empty">Fără tichete</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && viewMode === "list" ? (
        <div className="table-wrap">
          <table className="data-table comms-table">
            <thead>
              <tr>
                <th>Titlu</th>
                <th>Stare</th>
                <th>Prioritate</th>
                <th>Categorie</th>
                <th>Operator</th>
                <th>Scadență</th>
              </tr>
            </thead>
            <tbody>
              {allTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="comms-empty-cell">
                    <p>Nu am găsit tichete{hasActiveFilters ? " pentru filtrele alese" : ""}.</p>
                    {!hasActiveFilters ? (
                      <button type="button" className="btn-primary" onClick={onCreateClick}>
                        Creează primul tichet
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {allTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`comms-row${openedTicketId === ticket.id ? " selected" : ""}`}
                  onClick={() => onOpenTicket(ticket.id)}
                >
                  <td className="comms-title-cell">{ticket.title}</td>
                  <td>
                    <span className={`comms-status comms-status--${statusTone(ticket.status)}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </td>
                  <td>
                    <span className={`comms-status comms-status--${priorityTone(ticket.priority)}`}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </td>
                  <td>{ticket.category ?? "—"}</td>
                  <td>{ticket.assignedToName || ticket.assignedToUserId || "Neasignat"}</td>
                  <td>{formatTicketDate(ticket.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
