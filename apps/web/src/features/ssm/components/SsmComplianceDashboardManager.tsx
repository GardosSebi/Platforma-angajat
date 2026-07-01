import { useMemo } from "react";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { useSsmComplianceDashboard, useUnifiedSsmCalendar } from "../hooks/useSsmOverview";

const SOURCE_LABELS: Record<string, string> = {
  TRAINING: "Instruire",
  MEDICAL: "Medical",
  EIP: "EIP",
  PSI: "PSI",
  PSI_TRAINING: "Instruire PSI"
};

const TRAFFIC_LABELS: Record<string, string> = {
  GREEN: "Verde",
  YELLOW: "Galben",
  RED: "Roșu"
};

const TRAFFIC_CHIP: Record<string, string> = {
  GREEN: "good",
  YELLOW: "warn",
  RED: "bad"
};

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export function SsmComplianceDashboardManager() {
  const calendarQuery = useUnifiedSsmCalendar();
  const dashboardQuery = useSsmComplianceDashboard();

  const upcomingEvents = useMemo(
    () => (calendarQuery.data?.events ?? []).slice(0, 12),
    [calendarQuery.data?.events]
  );
  const kpi = dashboardQuery.data?.kpi;

  return (
    <section className="ssm-documents" aria-labelledby="ssm-compliance-dashboard-title">
      <div className="ssm-module-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea J · 3.10</p>
          <h2 id="ssm-compliance-dashboard-title" className="card-title">
            Calendar + Dashboard conformitate
          </h2>
          <p className="ssm-hero-lead">
            O singură privire pentru instruiri, medical, EIP, PSI și restanțe. KPI-ul global îți arată rapid unde trebuie intervenit.
          </p>
          <div className="ssm-badge-row">
            <span className={`ssm-chip ${kpi ? TRAFFIC_CHIP[kpi.trafficLight] : ""}`}>
              Status: {kpi ? TRAFFIC_LABELS[kpi.trafficLight] : "-"}
            </span>
            <span className="ssm-chip">Calendar unificat</span>
            <span className="ssm-chip">Drill-down restanțe</span>
          </div>
        </div>

        <div className="ssm-summary-strip">
          <div className="ssm-stat-card">
            <span>Scor global</span>
            <strong>{kpi ? `${kpi.globalScore}%` : "-"}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Verificări</span>
            <strong>{kpi?.totalChecks ?? "-"}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Neconforme</span>
            <strong>{kpi?.noncompliant ?? "-"}</strong>
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid">
        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Breakdown conformitate</h3>
              <p className="field-hint">Scor pe module, cu progres vizual.</p>
            </div>
          </div>
          <div className="ssm-doc-items">
            {(dashboardQuery.data?.breakdown ?? []).map((item) => (
              <article key={item.module} className="ssm-doc-item">
                <strong>
                  {item.module} · {item.score}%
                </strong>
                <span>
                  conforme {item.compliant}/{item.total} · neconforme {item.noncompliant}
                </span>
                <div className="ssm-progress" aria-label={`Scor ${item.module} ${item.score}%`}>
                  <span style={{ width: `${Math.max(0, Math.min(item.score, 100))}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Top neconformități</h3>
              <p className="field-hint">Primele zone care merită curățate.</p>
            </div>
          </div>
          <div className="ssm-doc-items">
            {(dashboardQuery.data?.topNonconformities ?? []).map((item) => (
              <article key={item.module} className="ssm-doc-item">
                <strong>{item.module}</strong>
                <span>
                  {item.count} neconformități · scor {item.score}%
                </span>
              </article>
            ))}
            {!dashboardQuery.isLoading && (dashboardQuery.data?.topNonconformities.length ?? 0) === 0 ? (
              <p className="field-hint">Nu există neconformități active.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid second">
        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Calendar unificat</h3>
              <p className="field-hint">Evenimente apropiate din toate modulele SSM.</p>
            </div>
            <span className="ssm-chip">{upcomingEvents.length} evenimente</span>
          </div>
          <div className="ssm-doc-items">
            {upcomingEvents.map((event) => (
              <article key={`${event.source}-${event.id}`} className="ssm-doc-item">
                <strong>
                  {SOURCE_LABELS[event.source] ?? event.source} · {event.title}
                </strong>
                <span>
                  scadență {formatDate(event.dueAt)} · status {event.status}
                </span>
              </article>
            ))}
            {!calendarQuery.isLoading && upcomingEvents.length === 0 ? (
              <p className="field-hint">Nu există evenimente în calendar.</p>
            ) : null}
          </div>
          <div className="ssm-inline-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void downloadWithAuth("/ssm/overview/calendar.ics", "ssm-calendar.ics").catch(() => undefined);
              }}
            >
              Export iCal
            </button>
          </div>
          <p className="field-hint">Calendar agregat: instruiri, medical, EIP, PSI. Export iCal pentru Outlook/Google.</p>
        </div>

        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Drill-down restanțe</h3>
              <p className="field-hint">Lista scurtă cu ce trebuie închis prima dată.</p>
            </div>
            <span className="ssm-chip bad">{dashboardQuery.data?.overdueItems.length ?? 0} restanțe</span>
          </div>
          <div className="ssm-doc-items">
            {(dashboardQuery.data?.overdueItems ?? []).slice(0, 12).map((item) => (
              <article key={`${item.module}-${item.id}`} className="ssm-doc-item">
                <strong>
                  {item.module} · {item.title}
                </strong>
                <span>
                  {item.subject} · {formatDate(item.dueAt)} · {item.daysOverdue} zile · {item.severity}
                </span>
              </article>
            ))}
            {!dashboardQuery.isLoading && (dashboardQuery.data?.overdueItems.length ?? 0) === 0 ? (
              <p className="field-hint">Nu există restanțe pentru drill-down.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
