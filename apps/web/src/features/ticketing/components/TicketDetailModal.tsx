import { FormEvent, useState } from "react";
import type { HelpdeskTicketItem, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useAddTicketComment, useTicketComments } from "../hooks/useTicketing";
import {
  formatTicketDate,
  mutationErrorMessage,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUSES,
  STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  type TicketOperatorOption
} from "../ticketing-shared";

type AssignState = { assignedToUserId: string; assignedToName: string };

type Props = {
  ticket: HelpdeskTicketItem;
  assignState: AssignState;
  operators: TicketOperatorOption[];
  movePending: boolean;
  assignPending: boolean;
  onClose: () => void;
  onMove: (status: HelpdeskTicketStatus) => void;
  onAssignChange: (patch: Partial<AssignState>) => void;
  onAssign: () => void;
};

function categoryLabel(category?: string | null): string {
  if (!category) return "General";
  return TICKET_CATEGORY_LABELS[category as keyof typeof TICKET_CATEGORY_LABELS] ?? category;
}

export function TicketDetailModal({
  ticket,
  assignState,
  operators,
  movePending,
  assignPending,
  onClose,
  onMove,
  onAssignChange,
  onAssign
}: Props) {
  const [commentBody, setCommentBody] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentsQuery = useTicketComments(ticket.id);
  const addComment = useAddTicketComment();

  const onOperatorChange = (operatorId: string) => {
    const operator = operators.find((item) => item.id === operatorId);
    onAssignChange({
      assignedToUserId: operatorId,
      assignedToName: operator?.name ?? ""
    });
  };

  const onCommentSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    setCommentError(null);
    addComment.mutate(
      { id: ticket.id, payload: { body, internal: commentInternal } },
      {
        onSuccess: () => {
          setCommentBody("");
          setCommentInternal(false);
        },
        onError: (error) => setCommentError(mutationErrorMessage(error))
      }
    );
  };

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
              {STATUS_LABELS[ticket.status]} · {categoryLabel(ticket.category)} · {SOURCE_LABELS[ticket.source]}
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
            <span>Operator</span>
            <strong>{ticket.assignedToName || ticket.assignedToUserId || "Neasignat"}</strong>
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
            <FieldSelect
              id={`assign-${ticket.id}`}
              label="Operator"
              value={assignState.assignedToUserId}
              onChange={onOperatorChange}
              allowEmpty
              emptyLabel="Neasignat"
              options={mapToOptions(
                operators,
                (operator) => operator.id,
                (operator) => operator.name
              )}
            />
          </div>
          <div className="comms-inline-actions">
            <button type="button" className="btn-primary" onClick={onAssign} disabled={assignPending || !assignState.assignedToUserId}>
              {assignPending ? "Se asignează..." : "Asignează operator"}
            </button>
          </div>
        </fieldset>

        <section className="ticket-comments-section">
          <h3 className="card-title">Comentarii ({ticket.commentsCount})</h3>
          {commentsQuery.isLoading ? <p className="field-hint">Se încarcă comentariile...</p> : null}
          {commentsQuery.data?.items.length ? (
            <ul className="ticket-comments-list">
              {commentsQuery.data.items.map((comment) => (
                <li key={comment.id} className={`ticket-comment${comment.internal ? " internal" : ""}`}>
                  <p>{comment.body}</p>
                  <span className="ticket-comment-meta">
                    {formatTicketDate(comment.createdAt)}
                    {comment.internal ? " · intern" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : !commentsQuery.isLoading ? (
            <p className="field-hint">Nu există comentarii încă.</p>
          ) : null}

          <form className="ticket-comment-form" onSubmit={onCommentSubmit}>
            <div className="field">
              <label htmlFor={`comment-${ticket.id}`}>Adaugă comentariu</label>
              <textarea
                id={`comment-${ticket.id}`}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={3}
                placeholder="Răspuns sau notă pentru solicitant..."
                required
              />
            </div>
            <label className="ticket-comment-internal">
              <input
                type="checkbox"
                checked={commentInternal}
                onChange={(event) => setCommentInternal(event.target.checked)}
              />
              Comentariu intern (vizibil doar operatorilor)
            </label>
            <div className="comms-inline-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={addComment.isPending || !commentBody.trim()}>
                {addComment.isPending ? "Se trimite..." : "Trimite comentariu"}
              </button>
            </div>
            {commentError ? (
              <div className="feedback error" role="alert">
                {commentError}
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
