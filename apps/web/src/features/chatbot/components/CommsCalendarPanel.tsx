import type { CommunicationCalendarEntry } from "@repo/shared-types/communications";
import { STATUS_LABELS, formatCommsDate } from "../comms-shared";

type Props = {
  items: CommunicationCalendarEntry[];
  isLoading: boolean;
  onOpenAnnouncement: (id: string) => void;
};

export function CommsCalendarPanel({ items, isLoading, onOpenAnnouncement }: Props) {
  const grouped = items.reduce<Record<string, CommunicationCalendarEntry[]>>((acc, item) => {
    const day = item.publishAt.slice(0, 10);
    acc[day] = acc[day] ?? [];
    acc[day].push(item);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort();

  return (
    <section className="card comms-panel">
      <h2 className="card-title">Calendar programări</h2>
      <p className="comms-toolbar-hint">Anunțuri programate sau gata de trimis, grupate pe zi.</p>
      {isLoading ? <p className="field-hint">Se încarcă calendarul…</p> : null}
      {!isLoading && !days.length ? (
        <p className="field-hint">Nu există trimiteri programate.</p>
      ) : null}
      <div className="comms-calendar-list">
        {days.map((day) => (
          <div key={day} className="comms-calendar-day">
            <h3>{new Date(`${day}T12:00:00`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}</h3>
            <ul>
              {grouped[day]!.map((item) => (
                <li key={item.id}>
                  <button type="button" className="btn-text-link" onClick={() => onOpenAnnouncement(item.id)}>
                    <strong>{item.title}</strong>
                  </button>
                  <span className="field-hint">
                    {formatCommsDate(item.publishAt)} · {STATUS_LABELS[item.status]}
                    {item.audienceLabel ? ` · ${item.audienceLabel}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
