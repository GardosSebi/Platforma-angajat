import { useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import {
  HELPDESK_TICKET_STATUSES,
  type CreateHelpdeskTicketRequest,
  type HelpdeskTicketItem,
  type HelpdeskTicketPriority,
  type HelpdeskTicketSource,
  type HelpdeskTicketStatus
} from "@repo/shared-types/ticketing";
import { useEmployees } from "../../master-data/hooks/useMasterData";
import { TicketFilters } from "../api/ticketing.api";
import { useAssignTicket, useCreateTicket, useMoveTicket, useTicketingKanban, useTicketingStats } from "../hooks/useTicketing";

const STATUSES = [...HELPDESK_TICKET_STATUSES] as HelpdeskTicketStatus[];
const PRIORITIES: HelpdeskTicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SOURCES: HelpdeskTicketSource[] = ["PORTAL", "SURVEY", "CHATBOT", "EMAIL", "MANUAL"];

const STATUS_LABELS: Record<HelpdeskTicketStatus, string> = {
  OPEN: "Deschis",
  WAITING_OPERATOR: "În așteptare operator",
  WAITING_USER: "În așteptare utilizator",
  WAITING_INFO: "În așteptare informații",
  CLOSED: "Închis"
};

const PRIORITY_LABELS: Record<HelpdeskTicketPriority, string> = {
  LOW: "Scăzută",
  MEDIUM: "Medie",
  HIGH: "Ridicată",
  URGENT: "Urgentă"
};

const TICKET_CATEGORIES = ["HR", "CONCEDIU", "IT", "LEGAL", "FACILITĂȚI", "ALTE"] as const;

const EMPTY_TICKET: CreateHelpdeskTicketRequest = {
  title: "Cerere concediu / HR",
  description: "Descrierea solicitării interne (ex: perioada, motiv, date de contact)...",
  category: "HR",
  priority: "MEDIUM",
  source: "PORTAL",
  reporterEmployeeId: "",
  reporterName: "",
  reporterEmail: "",
  assignedToUserId: "",
  assignedToName: "",
  sourceSurveyResponseId: "",
  dueAt: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function priorityChip(priority: HelpdeskTicketPriority): string {
  if (priority === "URGENT" || priority === "HIGH") return "bad";
  if (priority === "MEDIUM") return "warn";
  return "good";
}

export function TicketingPage() {
  const employeesQuery = useEmployees();
  const [filters, setFilters] = useState<TicketFilters>({});
  const [ticketForm, setTicketForm] = useState<CreateHelpdeskTicketRequest>(EMPTY_TICKET);
  const [assignByTicketId, setAssignByTicketId] = useState<Record<string, { assignedToUserId: string; assignedToName: string }>>({});
  const [draggedTicket, setDraggedTicket] = useState<{ id: string; status: HelpdeskTicketStatus } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<HelpdeskTicketStatus | null>(null);
  const [openedTicketId, setOpenedTicketId] = useState("");

  const kanbanQuery = useTicketingKanban(filters);
  const statsQuery = useTicketingStats();
  const createTicket = useCreateTicket();
  const moveTicket = useMoveTicket();
  const assignTicket = useAssignTicket();

  const stats = statsQuery.data;
  const columns = kanbanQuery.data?.columns ?? STATUSES.map((status) => ({ status, tickets: [] }));
  const openedTicket = useMemo(() => columns.flatMap((column) => column.tickets).find((ticket) => ticket.id === openedTicketId), [columns, openedTicketId]);
  const operatorOptions = useMemo(() => stats?.operators ?? [], [stats?.operators]);

  const onReporterChange = (employeeId: string) => {
    const employee = employeesQuery.data?.find((item) => item.id === employeeId);
    setTicketForm((prev) => ({
      ...prev,
      reporterEmployeeId: employeeId,
      reporterName: employee?.fullName ?? "",
      reporterEmail: employee?.email ?? ""
    }));
  };

  const onTicketSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTicket.mutate(
      {
        ...ticketForm,
        category: ticketForm.category || undefined,
        reporterEmployeeId: ticketForm.reporterEmployeeId || undefined,
        reporterName: ticketForm.reporterName || undefined,
        reporterEmail: ticketForm.reporterEmail || undefined,
        assignedToUserId: ticketForm.assignedToUserId || undefined,
        assignedToName: ticketForm.assignedToName || undefined,
        sourceSurveyResponseId: ticketForm.sourceSurveyResponseId || undefined,
        dueAt: ticketForm.dueAt || undefined
      },
      { onSuccess: () => setTicketForm(EMPTY_TICKET) }
    );
  };

  const assign = (ticket: HelpdeskTicketItem) => {
    const payload = assignByTicketId[ticket.id] ?? {
      assignedToUserId: ticket.assignedToUserId ?? "",
      assignedToName: ticket.assignedToName ?? ""
    };
    if (!payload?.assignedToUserId) return;
    assignTicket.mutate({ id: ticket.id, ...payload });
  };

  const moveToStatus = (ticket: HelpdeskTicketItem, status: HelpdeskTicketStatus) => {
    if (ticket.status === status || moveTicket.isPending) return;
    moveTicket.mutate({ id: ticket.id, status });
  };

  const onTicketDragStart = (event: DragEvent<HTMLElement>, ticket: HelpdeskTicketItem) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ticket.id);
    setDraggedTicket({ id: ticket.id, status: ticket.status });
  };

  const onColumnDragOver = (event: DragEvent<HTMLDivElement>, status: HelpdeskTicketStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const onColumnDrop = (event: DragEvent<HTMLDivElement>, status: HelpdeskTicketStatus) => {
    event.preventDefault();
    if (!draggedTicket || draggedTicket.status === status) {
      setDraggedTicket(null);
      setDragOverStatus(null);
      return;
    }
    moveTicket.mutate(
      { id: draggedTicket.id, status },
      {
        onSettled: () => {
          setDraggedTicket(null);
          setDragOverStatus(null);
        }
      }
    );
  };

  return (
    <>
      <h1 className="page-title">Tichete — Help desk intern</h1>
      <p className="page-lead">
        Modul 4.4: solicitări interne (ex. concediu, HR), Kanban pe stări, filtre după subiect / destinatar / operator și
        statistici.
      </p>

      <section className="ssm-documents" aria-labelledby="ticketing-title">
        <div className="ssm-module-hero">
          <div className="card ssm-hero-card">
            <p className="ssm-card-eyebrow">4.4 Help desk intern</p>
            <h2 id="ticketing-title" className="card-title">
              Tichete interne
            </h2>
            <p className="ssm-hero-lead">
              Solicitări interne ale angajaților: deschis, în așteptare operator, utilizator sau informații, apoi închis.
              Filtrează după subiect (titlu), destinatar (nume operator) și operator (ID).
            </p>
            <div className="ssm-badge-row">
              <span className="ssm-chip">Kanban</span>
              <span className="ssm-chip">HR / concediu</span>
              <span className="ssm-chip">Statistici</span>
            </div>
          </div>

          <div className="ssm-summary-strip">
            <div className="ssm-stat-card">
              <span>Total</span>
              <strong>{stats?.total ?? "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Deschise (≠ închis)</span>
              <strong>{stats?.open ?? "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Depășite termen</span>
              <strong>{stats?.overdue ?? "-"}</strong>
            </div>
          </div>
        </div>

        <div className="ssm-doc-grid">
          <form className="card form-stack ssm-doc-card" onSubmit={onTicketSubmit}>
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Creează tichet</h3>
                <p className="field-hint">Solicitare manuală sau legată de un răspuns la sondaj.</p>
              </div>
            </div>
            <div className="ssm-form-grid">
              <div className="field wide">
                <label htmlFor="ticket-title">Titlu</label>
                <input id="ticket-title" value={ticketForm.title} onChange={(event) => setTicketForm((prev) => ({ ...prev, title: event.target.value }))} required />
              </div>
              <div className="field wide">
                <label htmlFor="ticket-description">Descriere</label>
                <textarea
                  id="ticket-description"
                  value={ticketForm.description}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="ticket-category">Categorie (ex. HR, concediu)</label>
                <input
                  id="ticket-category"
                  list="ticket-category-options"
                  value={ticketForm.category ?? ""}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, category: event.target.value }))}
                />
                <datalist id="ticket-category-options">
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="ticket-priority">Prioritate</label>
                <select
                  id="ticket-priority"
                  value={ticketForm.priority}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, priority: event.target.value as HelpdeskTicketPriority }))}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ticket-source">Sursă</label>
                <select id="ticket-source" value={ticketForm.source} onChange={(event) => setTicketForm((prev) => ({ ...prev, source: event.target.value as HelpdeskTicketSource }))}>
                  {SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ticket-due">Scadență</label>
                <input id="ticket-due" type="datetime-local" value={ticketForm.dueAt ?? ""} onChange={(event) => setTicketForm((prev) => ({ ...prev, dueAt: event.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="ticket-reporter">Solicitant angajat</label>
                <select id="ticket-reporter" value={ticketForm.reporterEmployeeId ?? ""} onChange={(event) => onReporterChange(event.target.value)}>
                  <option value="">Fără angajat</option>
                  {(employeesQuery.data ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ticket-assignee">Operator ID</label>
                <input
                  id="ticket-assignee"
                  value={ticketForm.assignedToUserId ?? ""}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, assignedToUserId: event.target.value }))}
                  placeholder="userId"
                />
              </div>
              <div className="field wide">
                <label htmlFor="ticket-survey-response">Răspuns sondaj sursă</label>
                <input
                  id="ticket-survey-response"
                  value={ticketForm.sourceSurveyResponseId ?? ""}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, sourceSurveyResponseId: event.target.value, source: event.target.value ? "SURVEY" : prev.source }))}
                  placeholder="surveyResponseId opțional"
                />
                <p className="field-hint">Pentru creare tichet la completare sondaj, salvează aici ID-ul răspunsului.</p>
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? "Se salvează..." : "Creează tichet"}
            </button>
            {createTicket.isError ? <div className="feedback error">{mutationErrorMessage(createTicket.error)}</div> : null}
          </form>

          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Filtre și operatori</h3>
                <p className="field-hint">
                  Subiect = titlu tichet; destinatar = nume operator asignat; operator = ID utilizator. Opțional: status,
                  prioritate, solicitant, căutare în descriere.
                </p>
              </div>
            </div>
            <div className="ssm-form-grid">
              <div className="field">
                <label htmlFor="filter-subject">Subiect (titlu)</label>
                <input
                  id="filter-subject"
                  value={filters.subject ?? ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value || undefined }))}
                  placeholder="ex: concediu"
                />
              </div>
              <div className="field">
                <label htmlFor="filter-recipient-name">Destinatar (nume operator)</label>
                <input
                  id="filter-recipient-name"
                  value={filters.assignedToName ?? ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assignedToName: event.target.value || undefined }))}
                  placeholder="conține în numele operatorului"
                />
              </div>
              <div className="field">
                <label htmlFor="filter-operator">Operator (ID user)</label>
                <input
                  id="filter-operator"
                  value={filters.assignedToUserId ?? ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assignedToUserId: event.target.value || undefined }))}
                  placeholder="userId"
                />
              </div>
              <div className="field">
                <label htmlFor="filter-reporter">Solicitant (angajat)</label>
                <select
                  id="filter-reporter"
                  value={filters.reporterEmployeeId ?? ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, reporterEmployeeId: event.target.value || undefined }))}
                >
                  <option value="">Toți</option>
                  {(employeesQuery.data ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter-status">Status</label>
                <select id="filter-status" value={filters.status ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as HelpdeskTicketStatus || undefined }))}>
                  <option value="">Toate</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter-priority">Prioritate</label>
                <select id="filter-priority" value={filters.priority ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value as HelpdeskTicketPriority || undefined }))}>
                  <option value="">Toate</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field wide">
                <label htmlFor="filter-search">Căutare în descriere / solicitant</label>
                <input id="filter-search" value={filters.search ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value || undefined }))} />
              </div>
            </div>
            <div className="ssm-doc-items">
              {operatorOptions.map((operator) => (
                <article key={operator.assignedToUserId} className="ssm-doc-item">
                  <strong>{operator.assignedToName || operator.assignedToUserId}</strong>
                  <span>{operator.count} tichete asignate</span>
                </article>
              ))}
              {!operatorOptions.length ? <p className="field-hint">Nu există operatori asignați încă.</p> : null}
            </div>
          </div>
        </div>

        {stats?.byStatus?.length ? (
          <div className="card ssm-doc-card" style={{ marginBottom: "1rem" }}>
            <h3 className="card-title">Statistici pe stare</h3>
            <div className="sss-summary-strip">
              {stats.byStatus.map((row) => (
                <div key={row.status} className="sss-stat-card">
                  <span>{STATUS_LABELS[row.status]}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stats?.byCategory?.length ? (
          <div className="card ssm-doc-card" style={{ marginBottom: "1rem" }}>
            <h3 className="card-title">Statistici pe categorie</h3>
            <ul className="static-page-links" style={{ margin: 0 }}>
              {stats.byCategory.map((row) => (
                <li key={row.category || "__none__"}>
                  <strong>{row.category || "Fără categorie"}</strong>
                  <span className="text-muted"> — {row.count} tichete</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="card ssm-doc-card ssm-documents" aria-label="Kanban helpdesk">
          <div className="ssm-card-header">
            <div>
                <h3 className="card-title">Kanban — stări (4.4)</h3>
                <p className="field-hint">
                  Deschis · În așteptare operator · În așteptare utilizator · În așteptare informații · Închis. Trage
                  cardurile între coloane.
                </p>
            </div>
          </div>
          <div className="ssm-overview-tabs ticket-kanban-board">
            {columns.map((column) => (
              <div
                key={column.status}
                className={`ssm-doc-item ticket-kanban-column ${dragOverStatus === column.status ? "drop-target" : ""}`}
                onDragOver={(event) => onColumnDragOver(event, column.status)}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(event) => onColumnDrop(event, column.status)}
              >
                <strong>
                  {STATUS_LABELS[column.status]} · {column.tickets.length}
                </strong>
                <div className="ssm-doc-items">
                  {column.tickets.map((ticket) => (
                    <article
                      key={ticket.id}
                      className={`ssm-doc-item ticket-kanban-card ${draggedTicket?.id === ticket.id ? "dragging" : ""} ${openedTicketId === ticket.id ? "selected" : ""}`}
                      draggable
                      onDragStart={(event) => onTicketDragStart(event, ticket)}
                      onDragEnd={() => {
                        setDraggedTicket(null);
                        setDragOverStatus(null);
                      }}
                    >
                      <strong>{ticket.title}</strong>
                      <span>{ticket.category ?? "General"} · scadență {formatDate(ticket.dueAt)}</span>
                      <div className="ssm-badge-row ticket-card-meta">
                        <span className={`ssm-chip ${priorityChip(ticket.priority)}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                        <span className="ssm-chip">{ticket.assignedToName || ticket.assignedToUserId || "Neasignat"}</span>
                      </div>
                      <div className="ssm-inline-actions">
                        <button type="button" className="btn-secondary ticket-open-button" onClick={() => setOpenedTicketId(ticket.id)}>
                          Deschide
                        </button>
                      </div>
                    </article>
                  ))}
                  {!column.tickets.length ? <p className="field-hint">Fără tichete în această stare.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        {openedTicket ? (
          <div className="ticket-detail-backdrop" role="presentation" onClick={() => setOpenedTicketId("")}>
            <div className="ticket-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title" onClick={(event) => event.stopPropagation()}>
              <div className="ssm-card-header">
                <div>
                  <p className="ssm-card-eyebrow">Tichet deschis</p>
                  <h4 id="ticket-detail-title" className="card-title">
                    {openedTicket.title}
                  </h4>
                  <p className="field-hint">
                    {STATUS_LABELS[openedTicket.status]} · {openedTicket.category ?? "General"} · {openedTicket.source}
                  </p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setOpenedTicketId("")}>
                  Închide
                </button>
              </div>

              <p className="ticket-detail-description">{openedTicket.description}</p>

              <div className="ticket-detail-grid">
                <div>
                  <span>Prioritate</span>
                  <strong>{PRIORITY_LABELS[openedTicket.priority]}</strong>
                </div>
                <div>
                  <span>Scadență</span>
                  <strong>{formatDate(openedTicket.dueAt)}</strong>
                </div>
                <div>
                  <span>Solicitant</span>
                  <strong>{openedTicket.reporterName || openedTicket.reporterEmail || openedTicket.reporterEmployeeId || "Nespecificat"}</strong>
                </div>
                <div>
                  <span>Comentarii</span>
                  <strong>{openedTicket.commentsCount}</strong>
                </div>
              </div>

              <div className="ssm-form-grid">
                <label className="ticket-move-select">
                  <span>Mută în status</span>
                  <select value={openedTicket.status} disabled={moveTicket.isPending} onChange={(event) => moveToStatus(openedTicket, event.target.value as HelpdeskTicketStatus)}>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <label htmlFor={`assign-${openedTicket.id}`}>Operator ID</label>
                  <input
                    id={`assign-${openedTicket.id}`}
                    value={assignByTicketId[openedTicket.id]?.assignedToUserId ?? openedTicket.assignedToUserId ?? ""}
                    onChange={(event) =>
                      setAssignByTicketId((prev) => ({
                        ...prev,
                        [openedTicket.id]: { ...(prev[openedTicket.id] ?? { assignedToName: openedTicket.assignedToName ?? "" }), assignedToUserId: event.target.value }
                      }))
                    }
                    placeholder="userId"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`assign-name-${openedTicket.id}`}>Nume operator</label>
                  <input
                    id={`assign-name-${openedTicket.id}`}
                    value={assignByTicketId[openedTicket.id]?.assignedToName ?? openedTicket.assignedToName ?? ""}
                    onChange={(event) =>
                      setAssignByTicketId((prev) => ({
                        ...prev,
                        [openedTicket.id]: { ...(prev[openedTicket.id] ?? { assignedToUserId: openedTicket.assignedToUserId ?? "" }), assignedToName: event.target.value }
                      }))
                    }
                    placeholder="Operator"
                  />
                </div>
              </div>

              <div className="ssm-inline-actions">
                <button type="button" className="btn-primary" onClick={() => assign(openedTicket)} disabled={assignTicket.isPending}>
                  {assignTicket.isPending ? "Se asignează..." : "Asignează"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
