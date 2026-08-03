import type { CommunicationAnnouncementItem } from "@repo/shared-types/communications";
import { formatCommsDate, STATUS_LABELS, statusTone } from "../comms-shared";

type Props = {
  items: CommunicationAnnouncementItem[];
  onSelect?: (id: string) => void;
};

export function CommsLatestAnnouncementsPanel({ items, onSelect }: Props) {
  if (!items.length) {
    return (
      <section className="comms-latest card" aria-labelledby="comms-latest-heading">
        <h2 id="comms-latest-heading" className="card-title">
          Ultimele anunțuri
        </h2>
        <p className="field-hint">Nu există anunțuri recente.</p>
      </section>
    );
  }

  return (
    <section className="comms-latest card" aria-labelledby="comms-latest-heading">
      <h2 id="comms-latest-heading" className="card-title">
        Ultimele anunțuri
      </h2>
      <ul className="comms-latest-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="comms-latest-item"
              onClick={() => onSelect?.(item.id)}
            >
              <span className={`comms-status comms-status--${statusTone(item.status)}`}>
                {STATUS_LABELS[item.status]}
              </span>
              <strong className="comms-latest-title">{item.title}</strong>
              <span className="comms-latest-meta">
                {item.createdByName?.trim() || "—"} · {formatCommsDate(item.publishAt ?? item.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
