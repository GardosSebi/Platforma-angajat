import type { CommunicationAnnouncementItem } from "@repo/shared-types/communications";
import { formatCommsDate, STATUS_LABELS } from "../comms-shared";

type Props = {
  items: CommunicationAnnouncementItem[];
  onOpen: (id: string) => void;
};

export function CommsLatestPanel({ items, onOpen }: Props) {
  if (!items.length) {
    return (
      <section className="card comms-panel">
        <h2 className="card-title">Ultimele anunțuri</h2>
        <p className="field-hint">Nu există anunțuri recente.</p>
      </section>
    );
  }

  return (
    <section className="card comms-panel">
      <h2 className="card-title">Ultimele anunțuri</h2>
      <ul className="comms-latest-list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="btn-text-link" onClick={() => onOpen(item.id)}>
              <strong>{item.title}</strong>
            </button>
            <span className="field-hint">
              {formatCommsDate(item.publishAt ?? item.createdAt)} · {item.createdByName ?? "—"} · {STATUS_LABELS[item.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
