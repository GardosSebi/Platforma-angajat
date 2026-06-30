import type { UsageSummaryResponse } from "@repo/shared-types/platform-admin";

type Props = {
  data: UsageSummaryResponse | undefined;
  isLoading: boolean;
};

export function CommsUsagePanel({ data, isLoading }: Props) {
  if (isLoading) return <p className="field-hint">Se încarcă statisticile…</p>;
  if (!data) return null;

  return (
    <section className="card comms-panel">
      <h2 className="card-title">Raport utilizare comunicări</h2>
      <p className="comms-toolbar-hint">
        Perioadă: {new Date(data.period.from).toLocaleDateString("ro-RO")} –{" "}
        {new Date(data.period.to).toLocaleDateString("ro-RO")}
      </p>
      <div className="comms-kpi">
        <div>
          <span>Utilizatori activi</span>
          <strong>{data.totals.activeUsersInPeriod}</strong>
        </div>
        <div>
          <span>Anunțuri publicate</span>
          <strong>{data.totals.announcementsPublishedInPeriod}</strong>
        </div>
        <div>
          <span>Confirmări citire</span>
          <strong>{data.totals.announcementReadsInPeriod}</strong>
        </div>
        <div>
          <span>Răspunsuri sondaje</span>
          <strong>{data.totals.surveyResponsesInPeriod}</strong>
        </div>
        <div>
          <span>Tichete create</span>
          <strong>{data.totals.helpdeskTicketsCreatedInPeriod}</strong>
        </div>
      </div>
      {data.auditEventsByModule.length ? (
        <ul className="comms-usage-modules">
          {data.auditEventsByModule.map((row) => (
            <li key={row.module}>
              <span>{row.module}</span>
              <strong>{row.events}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
