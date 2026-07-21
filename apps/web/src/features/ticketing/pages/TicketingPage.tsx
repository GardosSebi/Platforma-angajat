import { FormEvent, useMemo, useState, type DragEvent } from "react";
import type {
  CreateHelpdeskTicketFromEmailRequest,
  CreateHelpdeskTicketRequest,
  HelpdeskTicketItem,
  HelpdeskTicketStatus
} from "@repo/shared-types/ticketing";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import type { TicketFilters } from "../api/ticketing.api";
import {
  useAssignTicket,
  useCreateTicket,
  useCreateTicketFromEmail,
  useMoveTicket,
  useTicketingKanban,
  useTicketingStats,
  useTicketOperatorOptions
} from "../hooks/useTicketing";
import { TicketCreateForm } from "../components/TicketCreateForm";
import { TicketDetailModal } from "../components/TicketDetailModal";
import { TicketKanbanPanel } from "../components/TicketKanbanPanel";
import { TicketStatsPanel } from "../components/TicketStatsPanel";
import { mutationErrorMessage, STATUSES, type TicketingTab, type TicketViewMode } from "../ticketing-shared";

const EMPTY_TICKET: CreateHelpdeskTicketRequest = {
  title: "",
  description: "",
  category: "HR",
  priority: "MEDIUM",
  reporterEmployeeId: "",
  reporterName: "",
  reporterEmail: "",
  assignedToUserId: "",
  assignedToName: "",
  dueAt: ""
};

const EMPTY_EMAIL_TICKET: CreateHelpdeskTicketFromEmailRequest = {
  fromEmail: "",
  fromName: "",
  subject: "",
  body: ""
};

export function TicketingPage() {
  const employeesQuery = useEmployeeOptions();
  const [tab, setTab] = useState<TicketingTab>("board");
  const [viewMode, setViewMode] = useState<TicketViewMode>("kanban");
  const [filters, setFilters] = useState<TicketFilters>({});
  const [ticketForm, setTicketForm] = useState<CreateHelpdeskTicketRequest>(EMPTY_TICKET);
  const [emailForm, setEmailForm] = useState<CreateHelpdeskTicketFromEmailRequest>(EMPTY_EMAIL_TICKET);
  const [assignByTicketId, setAssignByTicketId] = useState<Record<string, { assignedToUserId: string; assignedToName: string }>>({});
  const [draggedTicket, setDraggedTicket] = useState<{ id: string; status: HelpdeskTicketStatus } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<HelpdeskTicketStatus | null>(null);
  const [openedTicketId, setOpenedTicketId] = useState("");
  const [createFeedback, setCreateFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const kanbanQuery = useTicketingKanban(filters);
  const statsQuery = useTicketingStats();
  const operators = useTicketOperatorOptions();
  const createTicket = useCreateTicket();
  const createTicketFromEmail = useCreateTicketFromEmail();
  const moveTicket = useMoveTicket();
  const assignTicket = useAssignTicket();

  const stats = statsQuery.data;
  const columns = kanbanQuery.data?.columns ?? STATUSES.map((status) => ({ status, tickets: [] }));
  const employees = employeesQuery.data?.items ?? [];

  const openedTicket = useMemo(
    () => columns.flatMap((column) => column.tickets).find((ticket) => ticket.id === openedTicketId),
    [columns, openedTicketId]
  );

  const onReporterChange = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    setTicketForm((prev) => ({
      ...prev,
      reporterEmployeeId: employeeId,
      reporterName: employee?.fullName ?? "",
      reporterEmail: employee?.email ?? ""
    }));
  };

  const onOperatorChange = (operatorId: string) => {
    const operator = operators.find((item) => item.id === operatorId);
    setTicketForm((prev) => ({
      ...prev,
      assignedToUserId: operatorId,
      assignedToName: operator?.name ?? ""
    }));
  };

  const onTicketSubmit = (event: FormEvent) => {
    event.preventDefault();
    setCreateFeedback(null);
    createTicket.mutate(
      {
        ...ticketForm,
        source: "MANUAL",
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim(),
        category: ticketForm.category || undefined,
        reporterEmployeeId: ticketForm.reporterEmployeeId || undefined,
        reporterName: ticketForm.reporterName || undefined,
        reporterEmail: ticketForm.reporterEmail || undefined,
        assignedToUserId: ticketForm.assignedToUserId || undefined,
        assignedToName: ticketForm.assignedToName || undefined,
        dueAt: ticketForm.dueAt || undefined
      },
      {
        onSuccess: () => {
          setTicketForm(EMPTY_TICKET);
          setCreateFeedback({ type: "success", message: "Tichet înregistrat în coloana Deschis." });
          setTab("board");
        },
        onError: (error) => {
          setCreateFeedback({ type: "error", message: mutationErrorMessage(error) });
        }
      }
    );
  };

  const onEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    setEmailFeedback(null);
    createTicketFromEmail.mutate(
      {
        fromEmail: emailForm.fromEmail.trim(),
        fromName: emailForm.fromName?.trim() || undefined,
        subject: emailForm.subject.trim(),
        body: emailForm.body.trim()
      },
      {
        onSuccess: () => {
          setEmailForm(EMPTY_EMAIL_TICKET);
          setEmailFeedback({ type: "success", message: "Tichet creat din email." });
          setTab("board");
        },
        onError: (error) => {
          setEmailFeedback({ type: "error", message: mutationErrorMessage(error) });
        }
      }
    );
  };

  const assign = (ticket: HelpdeskTicketItem) => {
    const payload = assignByTicketId[ticket.id] ?? {
      assignedToUserId: ticket.assignedToUserId ?? "",
      assignedToName: ticket.assignedToName ?? ""
    };
    if (!payload.assignedToUserId) return;
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

  const tabs: Array<{ id: TicketingTab; label: string }> = [
    { id: "board", label: "Board" },
    { id: "create", label: "Înregistrare manuală" },
    { id: "stats", label: "Statistici" }
  ];

  const assignState = openedTicket
    ? assignByTicketId[openedTicket.id] ?? {
        assignedToUserId: openedTicket.assignedToUserId ?? "",
        assignedToName: openedTicket.assignedToName ?? ""
      }
    : { assignedToUserId: "", assignedToName: "" };

  return (
    <div className="comms-page ticketing-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Help desk</h1>
          <p className="page-lead">Gestionează solicitările interne: HR, IT, concedii și altele.</p>
        </div>
      </header>

      <div className="comms-kpi" aria-label="Indicatori tichete">
        <div>
          <span>Total</span>
          <strong>{stats?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Deschise</span>
          <strong>{stats?.open ?? "—"}</strong>
        </div>
        <div>
          <span>Depășite termen</span>
          <strong>{stats?.overdue ?? "—"}</strong>
        </div>
      </div>

      <nav className="comms-tabs" aria-label="Secțiuni help desk">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "board" ? (
        <TicketKanbanPanel
          columns={columns}
          filters={filters}
          viewMode={viewMode}
          isLoading={kanbanQuery.isLoading}
          draggedTicketId={draggedTicket?.id ?? null}
          dragOverStatus={dragOverStatus}
          openedTicketId={openedTicketId}
          operators={operators}
          employees={employees}
          onViewModeChange={setViewMode}
          onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClearFilters={() => setFilters({})}
          onCreateClick={() => {
            setCreateFeedback(null);
            setEmailFeedback(null);
            setTab("create");
          }}
          onOpenTicket={setOpenedTicketId}
          onDragStart={onTicketDragStart}
          onDragEnd={() => {
            setDraggedTicket(null);
            setDragOverStatus(null);
          }}
          onColumnDragOver={onColumnDragOver}
          onColumnDragLeave={() => setDragOverStatus(null)}
          onColumnDrop={onColumnDrop}
        />
      ) : null}

      {tab === "create" ? (
        <div className="form-stack">
          <TicketCreateForm
            form={ticketForm}
            employees={employees}
            operators={operators}
            isPending={createTicket.isPending}
            feedback={createFeedback}
            onChange={(patch) => setTicketForm((prev) => ({ ...prev, ...patch }))}
            onReporterChange={onReporterChange}
            onOperatorChange={onOperatorChange}
            onSubmit={onTicketSubmit}
            onCancel={() => setTab("board")}
          />

          <form className="card form-stack comms-panel ticket-create-form" onSubmit={onEmailSubmit}>
            <div className="comms-compose-head">
              <div>
                <h2 className="card-title">Înregistrează din email</h2>
                <p className="comms-toolbar-hint">Creează un tichet pe baza unui mesaj email primit.</p>
              </div>
            </div>

            <fieldset className="comms-fieldset">
              <legend>Email</legend>
              <div className="comms-form-row">
                <div className="field">
                  <label htmlFor="email-from">De la (email) *</label>
                  <input
                    id="email-from"
                    type="email"
                    value={emailForm.fromEmail}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, fromEmail: event.target.value }))}
                    placeholder="ex: angajat@companie.ro"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="email-from-name">Nume expeditor</label>
                  <input
                    id="email-from-name"
                    value={emailForm.fromName ?? ""}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, fromName: event.target.value }))}
                    placeholder="Nume afișat"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="email-subject">Subiect *</label>
                <input
                  id="email-subject"
                  value={emailForm.subject}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Subiectul mesajului"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="email-body">Conținut *</label>
                <textarea
                  id="email-body"
                  value={emailForm.body}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Corpul mesajului email..."
                  rows={4}
                  required
                />
              </div>
            </fieldset>

            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createTicketFromEmail.isPending}>
                {createTicketFromEmail.isPending ? "Se înregistrează..." : "Înregistrează din email"}
              </button>
            </div>

            {emailFeedback ? (
              <div className={`feedback ${emailFeedback.type}`} role={emailFeedback.type === "error" ? "alert" : "status"}>
                {emailFeedback.message}
              </div>
            ) : null}
          </form>
        </div>
      ) : null}

      {tab === "stats" ? (
        <TicketStatsPanel stats={stats} isLoading={statsQuery.isLoading} onBack={() => setTab("board")} />
      ) : null}

      {openedTicket ? (
        <TicketDetailModal
          ticket={openedTicket}
          assignState={assignState}
          operators={operators}
          movePending={moveTicket.isPending}
          assignPending={assignTicket.isPending}
          onClose={() => setOpenedTicketId("")}
          onMove={(status) => moveToStatus(openedTicket, status)}
          onAssignChange={(patch) =>
            setAssignByTicketId((prev) => ({
              ...prev,
              [openedTicket.id]: { ...assignState, ...patch }
            }))
          }
          onAssign={() => assign(openedTicket)}
        />
      ) : null}
    </div>
  );
}
