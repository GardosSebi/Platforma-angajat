import type { HelpdeskTicketItem, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { formatTicketDate, PRIORITY_LABELS, SOURCE_LABELS, STATUSES, STATUS_LABELS } from "../ticketing-shared";

type AssignState = { assignedToUserId: string; assignedToName: string };

type Props = {
  ticket: HelpdeskTicketItem;
  assignState: AssignState;
  movePending: boolean;
  assignPending: boolean;
  onClose: () => void;
  onMove: (status: HelpdeskTicketStatus) => void;
  onAssignChange: (patch: Partial<AssignState>) => void;
  onAssign: () => void;
};

export function TicketDetailModal({
  ticket,
  assignState,
  movePending,
  assignPending,
  onClose,
  onMove,
  onAssignChange,
  onAssign
}: Props) {
  return (
    <div className="ticket-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ticket-detail-modal comms-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="comms-compose-head">
          <div>
            <h2 id="ticket-detail-title" className="card-title">
              {ticket.title}
            </h2>
            <p className="comms-toolbar-hint">
              {STATUS_LABELS[ticket.status]} · {ticket.category ?? "General"} · {SOURCE_LABELS[ticket.source]}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Închide
          </button>
        </div>

        <p className="ticket-detail-description">{ticket.description}</p>

        <div className="ticket-detail-grid">
          <div>
            <span>Prioritate</span>
            <strong>{PRIORITY_LABELS[ticket.priority]}</strong>
          </div>
          <div>
            <span>Scadență</span>
            <strong>{formatTicketDate(ticket.dueAt)}</strong>
          </div>
          <div>
            <span>Solicitant</span>
            <strong>{ticket.reporterName || ticket.reporterEmail || ticket.reporterEmployeeId || "Nespecificat"}</strong>
          </div>
          <div>
            <span>Comentarii</span>
            <strong>{ticket.commentsCount}</strong>
          </div>
        </div>

        <fieldset className="comms-fieldset">
          <legend>Acțiuni</legend>
          <div className="comms-form-row">
            <FieldSelect
              id={`move-status-${ticket.id}`}
              label="Mută în status"
              className="ticket-move-select"
              value={ticket.status}
              disabled={movePending}
              onChange={(status) => onMove(status as HelpdeskTicketStatus)}
              options={STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABELS[status]
              }))}
            />
            <div className="field">
              <label htmlFor={`assign-${ticket.id}`}>Operator ID</label>
              <input
                id={`assign-${ticket.id}`}
                value={assignState.assignedToUserId}
                onChange={(event) => onAssignChange({ assignedToUserId: event.target.value })}
                placeholder="userId"
              />
            </div>
            <div className="field">
              <label htmlFor={`assign-name-${ticket.id}`}>Nume operator</label>
              <input
                id={`assign-name-${ticket.id}`}
                value={assignState.assignedToName}
                onChange={(event) => onAssignChange({ assignedToName: event.target.value })}
                placeholder="Operator"
              />
            </div>
          </div>
          <div className="comms-inline-actions">
            <button type="button" className="btn-primary" onClick={onAssign} disabled={assignPending || !assignState.assignedToUserId}>
              {assignPending ? "Se asignează..." : "Asignează operator"}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
