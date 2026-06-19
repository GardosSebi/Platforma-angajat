import type { CommunicationAnnouncementItem } from "@repo/shared-types/communications";
import {
  AUDIENCE_LABELS,
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
  formatCommsDate,
  statusTone
} from "../comms-shared";

type Props = {
  announcement: CommunicationAnnouncementItem;
  canEdit: boolean;
  onClose: () => void;
  onPublish: () => void;
  onRetract: () => void;
  onDuplicate: () => void;
};

export function CommsAnnouncementDetail({ announcement, canEdit, onClose, onPublish, onRetract, onDuplicate }: Props) {
  const canPublish = announcement.status === "DRAFT" || announcement.status === "SCHEDULED";
  const canRetract = announcement.status === "PUBLISHED";

  return (
    <div className="comms-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="card comms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comms-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="comms-modal-head">
          <div>
            <span className={`comms-status comms-status--${statusTone(announcement.status)}`}>
              {STATUS_LABELS[announcement.status]}
            </span>
            <h2 id="comms-detail-title" className="card-title">
              {announcement.title}
            </h2>
            <p className="text-muted small">
              {CONTENT_TYPE_LABELS[announcement.contentType]} · {AUDIENCE_LABELS[announcement.audienceType]}
              {announcement.audienceLabel ? ` · ${announcement.audienceLabel}` : ""}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Închide
          </button>
        </div>

        <p className="comms-modal-body">{announcement.body}</p>

        {announcement.contentUrl ? (
          <p className="comms-modal-link">
            <a href={announcement.contentUrl} target="_blank" rel="noreferrer">
              Deschide link / document
            </a>
          </p>
        ) : null}

        <div className="comms-read-block">
          <div className="comms-read-block-head">
            <span>Rată de citire</span>
            <strong>{announcement.stats.readRate}%</strong>
          </div>
          <div className="comms-read-bar" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(announcement.stats.readRate, 100))}%` }} />
          </div>
          <p className="text-muted small">
            {announcement.stats.readCount} din {announcement.stats.targetCount} angajați au citit
          </p>
        </div>

        <dl className="comms-detail-dl">
          <div>
            <dt>Publicat</dt>
            <dd>{formatCommsDate(announcement.publishAt)}</dd>
          </div>
          <div>
            <dt>Expiră</dt>
            <dd>{formatCommsDate(announcement.expiresAt)}</dd>
          </div>
          <div>
            <dt>Memento</dt>
            <dd>{formatCommsDate(announcement.reminderAt)}</dd>
          </div>
          <div>
            <dt>Creat</dt>
            <dd>{formatCommsDate(announcement.createdAt)}</dd>
          </div>
        </dl>

        {canEdit ? (
          <div className="comms-modal-actions">
            {canPublish ? (
              <button className="btn-primary" type="button" onClick={onPublish}>
                Publică acum
              </button>
            ) : null}
            {canRetract ? (
              <button className="btn-secondary" type="button" onClick={onRetract}>
                Retrage anunțul
              </button>
            ) : null}
            <button className="btn-secondary" type="button" onClick={onDuplicate}>
              Duplică
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
