import { formatCommsDate, mutationErrorMessage } from "../comms-shared";

type ReminderItem = {
  announcementId: string;
  title: string;
  reminderAt: string;
  unreadCount: number;
  readRate: number;
};

type Props = {
  reminders: ReminderItem[];
  isLoading: boolean;
  canEdit: boolean;
  isDispatchPending: boolean;
  dispatchSent: number | null;
  dispatchError: unknown;
  onDispatch: () => void;
  onOpenAnnouncement: (id: string) => void;
};

export function CommsRemindersPanel({
  reminders,
  isLoading,
  canEdit,
  isDispatchPending,
  dispatchSent,
  dispatchError,
  onDispatch,
  onOpenAnnouncement
}: Props) {
  return (
    <section className="card comms-panel">
      <div className="comms-toolbar">
        <div>
          <h2 className="card-title">Mementouri</h2>
          <p className="comms-toolbar-hint">Anunțuri cu memento planificat pentru angajații care nu au citit.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn-secondary" onClick={onDispatch} disabled={isDispatchPending}>
            {isDispatchPending ? "Se trimit..." : "Trimite mementouri scadente"}
          </button>
        ) : null}
      </div>

      {isLoading ? <p className="text-muted">Se încarcă...</p> : null}
      {!isLoading && reminders.length === 0 ? (
        <p className="comms-empty-inline">Nu există mementouri planificate.</p>
      ) : (
        <ul className="comms-reminder-cards">
          {reminders.map((item) => (
            <li key={item.announcementId}>
              <button type="button" className="comms-reminder-card" onClick={() => onOpenAnnouncement(item.announcementId)}>
                <strong>{item.title}</strong>
                <span>Memento: {formatCommsDate(item.reminderAt)}</span>
                <span>
                  {item.unreadCount} necitite · {item.readRate}% citire
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dispatchSent !== null ? <div className="feedback success">Mementouri trimise: {dispatchSent}</div> : null}
      {dispatchError ? (
        <div className="feedback error" role="alert">
          {mutationErrorMessage(dispatchError)}
        </div>
      ) : null}
    </section>
  );
}
