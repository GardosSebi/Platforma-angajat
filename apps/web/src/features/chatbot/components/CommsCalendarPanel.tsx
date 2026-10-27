import type { CommunicationCalendarEntry } from "@repo/shared-types/communications";
import { STATUS_LABELS } from "../comms-shared";

type Props = {
  items: CommunicationCalendarEntry[];
  isLoading: boolean;
  onOpenAnnouncement: (id: string) => void;
};

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function relativeDayLabel(dayKey: string): string | null {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dayKey === localDayKey(today)) return "Azi";
  if (dayKey === localDayKey(tomorrow)) return "Mâine";
  return null;
}

export function CommsCalendarPanel({ items, isLoading, onOpenAnnouncement }: Props) {
  const grouped = items.reduce<Record<string, CommunicationCalendarEntry[]>>((acc, item) => {
    const day = localDayKey(new Date(item.publishAt));
    acc[day] = acc[day] ?? [];
    acc[day].push(item);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort();
  const todayKey = localDayKey(new Date());

  return (
    <section className="card comms-panel">
      <div className="comms-calendar-head">
        <div>
          <h2 className="card-title">Calendar programări</h2>
          <p className="comms-toolbar-hint">Anunțuri programate sau gata de trimis, grupate pe zi.</p>
        </div>
        {items.length ? (
          <span className="comms-calendar-count">
            {items.length} {items.length === 1 ? "trimitere" : "trimiteri"}
          </span>
        ) : null}
      </div>

      {isLoading ? <p className="field-hint">Se încarcă calendarul…</p> : null}
      {!isLoading && !days.length ? (
        <div className="comms-calendar-empty">
          <p>Nu există trimiteri programate.</p>
        </div>
      ) : null}

      <ol className="comms-calendar-list">
        {days.map((day) => {
          const date = new Date(`${day}T12:00:00`);
          const relative = relativeDayLabel(day);
          const entries = [...grouped[day]!].sort((a, b) => a.publishAt.localeCompare(b.publishAt));
          return (
            <li
              key={day}
              className={`comms-calendar-day${day === todayKey ? " is-today" : ""}${day < todayKey ? " is-past" : ""}`}
            >
              <div className="comms-calendar-date" aria-hidden>
                <span className="comms-calendar-date-month">
                  {date.toLocaleDateString("ro-RO", { month: "short" }).replace(".", "")}
                </span>
                <span className="comms-calendar-date-day">{date.getDate()}</span>
              </div>
              <div className="comms-calendar-day-body">
                <h3 className="comms-calendar-day-title">
                  {date.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
                  {relative ? <span className="comms-calendar-relative">{relative}</span> : null}
                </h3>
                <ul className="comms-calendar-entries">
                  {entries.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="comms-calendar-entry"
                        onClick={() => onOpenAnnouncement(item.id)}
                      >
                        <span className="comms-calendar-time">
                          {new Date(item.publishAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="comms-calendar-entry-main">
                          <strong>{item.title}</strong>
                          {item.audienceLabel ? (
                            <span className="comms-calendar-audience">{item.audienceLabel}</span>
                          ) : null}
                        </span>
                        <span className={`comms-calendar-status status-${item.status.toLowerCase()}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
