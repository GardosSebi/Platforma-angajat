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
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  type TicketOperatorOption,
  type TicketViewMode
} from "../ticketing-shared";

type Column = { status: HelpdeskTicketStatus; tickets: HelpdeskTicketItem[] };

type EmployeeOption = { id: string; fullName: string; email?: string };

type Props = {
  columns: Column[];
  filters: TicketFilters;
  viewMode: TicketViewMode;
  isLoading: boolean;
  draggedTicketId: string | null;
  dragOverStatus: HelpdeskTicketStatus | null;
  openedTicketId: string;
  operators: TicketOperatorOption[];
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

export function TicketKanbanPanel({
  columns,
  filters,
  viewMode,
  isLoading,
  draggedTicketId,
  dragOverStatus,
  openedTicketId,
  operators,
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
    filters.search ||
      filters.assignedToUserId ||
      filters.reporterEmployeeId ||
      filters.status ||
      filters.priority ||
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
          Adaugă înregistrare manuală
        </button>
      </div>

      <div className="comms-filters ticket-primary-filters">
        <div className="field comms-search-field">
          <label htmlFor="ticket-search">Caută</label>
          <input
            id="ticket-search"
            type="search"
            placeholder="Titlu, descriere, solicitant..."
            value={filters.search ?? ""}
            onChange={(event) => onFiltersChange({ search: event.target.value || undefined })}
          />
        </div>
        <FieldSelect
          id="filter-assignee"
          label="Operator"
          value={filters.assignedToUserId ?? ""}
          onChange={(assignedToUserId) => onFiltersChange({ assignedToUserId: assignedToUserId || undefined })}
          allowEmpty
          emptyLabel="Toți"
          options={mapToOptions(
            operators,
            (operator) => operator.id,
            (operator) => operator.name
          )}
        />
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
            (employee) => (employee.email ? `${employee.fullName} (${employee.email})` : employee.fullName)
          )}
        />
        <FieldSelect
          id="filter-destinatar"
          label="Destinatar"
          value={filters.category ?? ""}
          onChange={(category) => onFiltersChange({ category: category || undefined })}
          allowEmpty
          emptyLabel="Toate"
          options={TICKET_CATEGORIES.map((category) => ({
            value: category,
            label: TICKET_CATEGORY_LABELS[category]
          }))}
        />
        <FieldSelect
          id="filter-status"
          label="Stare"
          value={filters.status ?? ""}
          onChange={(status) => onFiltersChange({ status: (status as HelpdeskTicketStatus) || undefined })}
          allowEmpty
          emptyLabel="Toate"
          options={STATUSES.map((status) => ({
            value: status,
            label: STATUS_LABELS[status]
          }))}
        />
        <FieldSelect
          id="filter-priority"
          label="Prioritate"
          value={filters.priority ?? ""}
          onChange={(priority) => onFiltersChange({ priority: (priority as HelpdeskTicketPriority) || undefined })}
          allowEmpty
          emptyLabel="Toate"
          options={HELPDESK_TICKET_PRIORITIES.map((priority) => ({
            value: priority,
            label: PRIORITY_LABELS[priority]
          }))}
        />
        {hasActiveFilters ? (
          <button type="button" className="btn-secondary btn-sm ticket-filter-reset" onClick={onClearFilters}>
            Resetează
          </button>
        ) : null}
      </div>

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
