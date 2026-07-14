import { FormEvent, useMemo, useState } from "react";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import { useAdminUsers, useGrantItmAccess, useItmAccessLogs } from "../hooks/usePlatformAdmin";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ItmAccessPanel() {
  const usersQuery = useAdminUsers({ page: 1, pageSize: 100 });
  const logsQuery = useItmAccessLogs();
  const grantAccess = useGrantItmAccess();

  const [userId, setUserId] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const inspectorOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? [])
        .filter((user) => user.roles.includes("ITM_INSPECTOR"))
        .map((user) => ({
          value: user.id,
          label: `${user.fullName ?? user.email} (${user.email})`
        })),
    [usersQuery.data?.items]
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!userId) return;

    grantAccess.mutate(
      { userId, expiresAt },
      {
        onSuccess: () => {
          setFeedback({ type: "success", message: "Acces ITM acordat cu succes." });
        },
        onError: (error) => {
          setFeedback({ type: "error", message: mutationErrorMessage(error) });
        }
      }
    );
  };

  return (
    <div className="form-stack">
      <form className="card form-stack" onSubmit={onSubmit}>
        <h2 className="card-title">Acordare acces inspector ITM</h2>
        <p className="page-lead">
          Setează data expirării pentru conturile cu rol ITM_INSPECTOR. Fără acces activ, inspectorul nu poate
          deschide portalul de control.
        </p>

        <FieldSelect
          id="itm-user"
          label="Inspector ITM"
          value={userId}
          onChange={setUserId}
          options={inspectorOptions}
          required
          allowEmpty
          emptyLabel="Selectează inspector"
          hint={
            inspectorOptions.length === 0
              ? "Nu există utilizatori cu rol ITM_INSPECTOR. Adaugă rolul din Master Data."
              : undefined
          }
        />

        <div className="field">
          <label htmlFor="itm-expires">Expiră la</label>
          <input
            id="itm-expires"
            type="datetime-local"
            value={toDatetimeLocalValue(expiresAt)}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              setExpiresAt(new Date(value).toISOString());
            }}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={grantAccess.isPending || !userId}>
          {grantAccess.isPending ? "Se salvează..." : "Acordă acces ITM"}
        </button>

        {feedback ? (
          <p className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </p>
        ) : null}
      </form>

      <section className="card form-stack">
        <h3 className="card-title">Jurnal acces ITM</h3>
        {logsQuery.isLoading ? <p>Se încarcă...</p> : null}
        {(logsQuery.data ?? []).length === 0 && !logsQuery.isLoading ? (
          <p className="muted">Nu există înregistrări în jurnal.</p>
        ) : null}
        <ul className="list-plain">
          {(logsQuery.data ?? []).map((log) => (
            <li key={log.id} className="list-row">
              <div>
                <strong>{log.userEmail}</strong>
                <span className="muted">
                  {" "}
                  — {log.action} / {log.resourceType}
                  {log.resourceId ? ` (${log.resourceId})` : ""}
                </span>
                <div className="muted">{new Date(log.createdAt).toLocaleString("ro-RO")}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
