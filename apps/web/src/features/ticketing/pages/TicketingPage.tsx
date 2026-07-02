import { FormEvent, useMemo, useState, type DragEvent } from "react";
import type { CreateHelpdeskTicketRequest, HelpdeskTicketItem, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import type { TicketFilters } from "../api/ticketing.api";
import { useAssignTicket, useCreateTicket, useMoveTicket, useTicketingKanban, useTicketingStats, useTicketOperatorOptions } from "../hooks/useTicketing";
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

export function TicketingPage() {
  const employeesQuery = useEmployeeOptions();
  const [tab, setTab] = useState<TicketingTab>("board");
  const [viewMode, setViewMode] = useState<TicketViewMode>("kanban");
  const [filters, setFilters] = useState<TicketFilters>({});
  const [ticketForm, setTicketForm] = useState<CreateHelpdeskTicketRequest>(EMPTY_TICKET);
  const [assignByTicketId, setAssignByTicketId] = useState<Record<string, { assignedToUserId: string; assignedToName: string }>>({});
  const [draggedTicket, setDraggedTicket] = useState<{ id: string; status: HelpdeskTicketStatus } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<HelpdeskTicketStatus | null>(null);
  const [openedTicketId, setOpenedTicketId] = useState("");
  const [createFeedback, setCreateFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const kanbanQuery = useTicketingKanban(filters);
  const statsQuery = useTicketingStats();
  const operators = useTicketOperatorOptions();
  const createTicket = useCreateTicket();
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
          onViewModeChange={setViewMode}
          onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClearFilters={() => setFilters({})}
          onCreateClick={() => {
            setCreateFeedback(null);
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
