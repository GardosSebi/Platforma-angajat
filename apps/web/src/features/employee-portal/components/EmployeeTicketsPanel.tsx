import { FormEvent, useMemo, useState } from "react";
import type {
  CreateHelpdeskTicketRequest,
  HelpdeskTicketItem,
  HelpdeskTicketPriority,
  HelpdeskTicketStatus
} from "@repo/shared-types/ticketing";
import { HELPDESK_TICKET_STATUSES } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { useCreateTicket, useTicketingKanban } from "../../ticketing/hooks/useTicketing";
import { formatRoDate, mutationErrorMessage } from "../utils";

const TICKET_CATEGORIES = ["HR", "CONCEDIU", "IT", "FACILITĂȚI", "ALTE"] as const;

const TICKET_CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  HR: "HR",
  CONCEDIU: "Concediu",
  IT: "IT",
  FACILITĂȚI: "Facilități",
  ALTE: "Altele"
};

const EMPLOYEE_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const satisfies readonly HelpdeskTicketPriority[];

const PRIORITY_LABELS: Record<(typeof EMPLOYEE_PRIORITIES)[number], string> = {
  LOW: "Scăzută",
  MEDIUM: "Medie",
  HIGH: "Ridicată"
};

const STATUS_LABELS: Record<HelpdeskTicketStatus, string> = {
  OPEN: "Deschis",
  WAITING_OPERATOR: "La operator",
  WAITING_USER: "Aștept răspunsul tău",
  WAITING_INFO: "Informații suplimentare",
  CLOSED: "Închis"
};

const EMPTY_TICKET: CreateHelpdeskTicketRequest = {
  title: "",
  description: "",
  category: "HR",
  priority: "MEDIUM",
  source: "PORTAL",
  reporterEmployeeId: "",
  reporterName: "",
  reporterEmail: ""
};

export function EmployeeTicketsPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const [ticketForm, setTicketForm] = useState<CreateHelpdeskTicketRequest>(EMPTY_TICKET);
  const [showForm, setShowForm] = useState(false);

  const filters = useMemo(
    () => (employeeId ? { reporterEmployeeId: employeeId, pageSize: 50 } : { pageSize: 50 }),
    [employeeId]
  );

  const kanbanQuery = useTicketingKanban(filters);
  const createTicket = useCreateTicket();

  const myTickets = useMemo(() => {
    const columns = kanbanQuery.data?.columns ?? [];
    return columns.flatMap((col) =>
      col.tickets.map((t: HelpdeskTicketItem) => ({ ...t, columnStatus: col.status }))
    );
  }, [kanbanQuery.data]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!employeeId) return;
    createTicket.mutate(
      {
        ...ticketForm,
        reporterEmployeeId: employeeId,
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim()
      },
      {
        onSuccess: () => {
          setTicketForm(EMPTY_TICKET);
          setShowForm(false);
        }
      }
    );
  };

  if (!employeeId) {
    return (
      <div className="employee-portal-empty card">
        <p>Contul nu este asociat unui angajat — nu poți trimite solicitări.</p>
      </div>
    );
  }

  return (
    <div className="employee-portal-tickets">
      <div className="ssm-inline-actions">
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Anulează" : "Solicitare nouă"}
        </button>
      </div>

      {showForm ? (
        <form className="card form-stack employee-ticket-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="ticket-title">Subiect</label>
            <input
              id="ticket-title"
              required
              value={ticketForm.title}
              onChange={(e) => setTicketForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="ex: Cerere concediu"
            />
          </div>
          <div className="field">
            <label htmlFor="ticket-desc">Descriere</label>
            <textarea
              id="ticket-desc"
              required
              rows={4}
              value={ticketForm.description}
              onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="ssm-form-grid">
            <FieldSelect
              id="ticket-cat"
              label="Categorie"
              value={ticketForm.category ?? "HR"}
              onChange={(category) => setTicketForm((p) => ({ ...p, category }))}
              options={TICKET_CATEGORIES.map((value) => ({
                value,
                label: TICKET_CATEGORY_LABELS[value]
              }))}
            />
            <FieldSelect
              id="ticket-priority"
              label="Prioritate"
              value={ticketForm.priority ?? "MEDIUM"}
              onChange={(priority) =>
                setTicketForm((p) => ({ ...p, priority: priority as HelpdeskTicketPriority }))
              }
              options={EMPLOYEE_PRIORITIES.map((value) => ({
                value,
                label: PRIORITY_LABELS[value]
              }))}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={createTicket.isPending}>
            {createTicket.isPending ? "Se trimite…" : "Trimite solicitarea"}
          </button>
          {createTicket.isError ? (
            <p className="feedback error">{mutationErrorMessage(createTicket.error)}</p>
          ) : null}
        </form>
      ) : null}

      <h3 className="ssm-subtitle">Solicitările mele</h3>
      {kanbanQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
      {!myTickets.length && !kanbanQuery.isLoading ? (
        <p className="field-hint">Nu ai solicitări înregistrate.</p>
      ) : (
        <ul className="employee-ticket-list">
          {myTickets.map((ticket) => (
            <li key={ticket.id} className="card employee-ticket-item">
              <strong>{ticket.title}</strong>
              <span className="ssm-chip">{STATUS_LABELS[ticket.status]}</span>
              <p className="field-hint">
                {ticket.category ?? "—"} · creat {formatRoDate(ticket.createdAt)}
              </p>
              <p>{ticket.description}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="field-hint">
        Stări posibile: {HELPDESK_TICKET_STATUSES.map((s) => STATUS_LABELS[s]).join(", ")}.
      </p>
    </div>
  );
}
