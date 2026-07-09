import type { CommunicationAnnouncementItem } from "@repo/shared-types/communications";
import { COMMUNICATION_CATEGORY_LABELS } from "@repo/shared-types/communications";
import {
  AUDIENCE_LABELS,
  CONTENT_TYPE_LABELS,
  MESSAGE_TYPE_LABELS,
  STATUS_LABELS,
  TRANSLATION_LOCALE_LABELS,
  canDeleteAnnouncement,
  formatCommsDate,
  statusTone
} from "../comms-shared";

type Props = {
  announcement: CommunicationAnnouncementItem | undefined;
  isLoading: boolean;
  error: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onRetract: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function CommsAnnouncementDetail({
  announcement,
  isLoading,
  error,
  canEdit,
  onClose,
  onEdit,
  onPublish,
  onRetract,
  onDuplicate,
  onDelete
}: Props) {
  const canPublish = announcement?.status === "DRAFT" || announcement?.status === "SCHEDULED";
  const canRetract = announcement?.status === "PUBLISHED";
  const translationEntries = Object.entries(announcement?.translations ?? {}).filter(
    ([, value]) => value.title?.trim() || value.body?.trim()
  );

  return (
    <div className="comms-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="card comms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comms-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isLoading ? (
          <>
            <div className="comms-modal-head">
              <h2 id="comms-detail-title" className="card-title">
                Se încarcă anunțul…
              </h2>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Închide
              </button>
            </div>
          </>
        ) : error ? (
          <>
            <div className="comms-modal-head">
              <h2 id="comms-detail-title" className="card-title">
                Detalii anunț
              </h2>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Închide
              </button>
            </div>
            <p className="feedback error" role="alert">
              {error}
            </p>
          </>
        ) : announcement ? (
          <>
            <div className="comms-modal-head">
              <div>
                <span className={`comms-status comms-status--${statusTone(announcement.status)}`}>
                  {STATUS_LABELS[announcement.status]}
                </span>
                <h2 id="comms-detail-title" className="card-title">
                  {announcement.title}
                </h2>
                <p className="text-muted small">
                  {COMMUNICATION_CATEGORY_LABELS[announcement.category]} · {MESSAGE_TYPE_LABELS[announcement.messageType]}{" "}
                  · {CONTENT_TYPE_LABELS[announcement.contentType]} · {AUDIENCE_LABELS[announcement.audienceType]}
                  {announcement.audienceLabel ? ` · ${announcement.audienceLabel}` : ""}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Închide
              </button>
            </div>

            <section className="comms-detail-section" aria-labelledby="comms-main-body-heading">
              <h3 id="comms-main-body-heading" className="comms-detail-section-title">
                Mesaj principal
              </h3>
              <p className="comms-modal-body">{announcement.body}</p>
            </section>

            {translationEntries.length > 0 ? (
              <section className="comms-detail-section" aria-labelledby="comms-translations-heading">
                <h3 id="comms-translations-heading" className="comms-detail-section-title">
                  Traduceri
                </h3>
                {translationEntries.map(([locale, value]) => (
                  <div key={locale} className="comms-translation-block">
                    <h4 className="comms-translation-locale">{TRANSLATION_LOCALE_LABELS[locale] ?? locale.toUpperCase()}</h4>
                    {value.title?.trim() ? <p className="comms-translation-title">{value.title}</p> : null}
                    {value.body?.trim() ? <p className="comms-modal-body">{value.body}</p> : null}
                  </div>
                ))}
              </section>
            ) : null}

            {announcement.contentUrl ? (
              <p className="comms-modal-link">
                <a href={announcement.contentUrl} target="_blank" rel="noreferrer">
                  Deschide link / document
                </a>
              </p>
            ) : null}

            {announcement.contentType === "BUTTON" && announcement.buttonUrl ? (
              <p className="comms-modal-link">
                <a href={announcement.buttonUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  {announcement.buttonLabel ?? "Deschide"}
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
                <button className="btn-primary" type="button" onClick={onEdit}>
                  Editează
                </button>
                {canPublish ? (
                  <button className="btn-secondary" type="button" onClick={onPublish}>
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
                {canDeleteAnnouncement(announcement.status) ? (
                  <button className="btn-text danger" type="button" onClick={onDelete}>
                    Șterge
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
