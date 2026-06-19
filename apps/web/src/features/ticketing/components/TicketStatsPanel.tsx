import type { HelpdeskStatsResponse } from "@repo/shared-types/ticketing";
import { PRIORITY_LABELS, STATUS_LABELS } from "../ticketing-shared";

type Props = {
  stats: HelpdeskStatsResponse | undefined;
  isLoading: boolean;
  onBack: () => void;
};

export function TicketStatsPanel({ stats, isLoading, onBack }: Props) {
  return (
    <div className="ticket-stats-stack">
      <section className="card comms-panel">
        <div className="comms-compose-head">
          <div>
            <h2 className="card-title">Statistici helpdesk</h2>
            <p className="comms-toolbar-hint">Distribuție pe stare, categorie, prioritate și operatori.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Înapoi la board
          </button>
        </div>

        {isLoading ? <p className="field-hint">Se încarcă statisticile...</p> : null}

        {stats ? (
          <>
            <div className="ticket-manage-summary">
              <div>
                <span>Total</span>
                <strong>{stats.total}</strong>
              </div>
              <div>
                <span>Deschise</span>
                <strong>{stats.open}</strong>
              </div>
              <div>
                <span>Depășite termen</span>
                <strong>{stats.overdue}</strong>
              </div>
            </div>

            {stats.byStatus.length > 0 ? (
              <div className="ticket-stats-section">
                <h3 className="card-title">Pe stare</h3>
                <div className="ticket-stats-chips">
                  {stats.byStatus.map((row) => (
                    <span key={row.status} className="comms-filter-chip">
                      {STATUS_LABELS[row.status]}: {row.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {stats.byCategory.length > 0 ? (
              <div className="ticket-stats-section">
                <h3 className="card-title">Pe categorie</h3>
                <div className="ticket-stats-chips">
                  {stats.byCategory.map((row) => (
                    <span key={row.category || "__none__"} className="comms-filter-chip">
                      {row.category || "Fără categorie"}: {row.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {stats.byPriority.length > 0 ? (
              <div className="ticket-stats-section">
                <h3 className="card-title">Pe prioritate</h3>
                <div className="ticket-stats-chips">
                  {stats.byPriority.map((row) => (
                    <span key={row.priority} className="comms-filter-chip">
                      {PRIORITY_LABELS[row.priority]}: {row.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {stats.operators.length > 0 ? (
              <div className="ticket-stats-section">
                <h3 className="card-title">Operatori</h3>
                <div className="ticket-stats-list">
                  {stats.operators.map((operator) => (
                    <article key={operator.assignedToUserId} className="ticket-stat-item">
                      <strong>{operator.assignedToName || operator.assignedToUserId}</strong>
                      <span>{operator.count} tichete asignate</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
