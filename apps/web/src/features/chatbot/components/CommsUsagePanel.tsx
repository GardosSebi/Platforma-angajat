import { useMemo, useState } from "react";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { CONTENT_TYPE_LABELS } from "../comms-shared";
import { useUsageSummary } from "../hooks/useChatbot";

type PeriodKey = "7" | "30" | "90";

function periodRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

type Props = {
  enabled: boolean;
};

export function CommsUsagePanel({ enabled }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("30");
  const range = useMemo(() => periodRange(Number(period)), [period]);
  const query = useUsageSummary(enabled, range.from, range.to);
  const data = query.data;

  if (query.isLoading) return <p className="field-hint">Se încarcă statisticile…</p>;
  if (!data) return null;

  return (
    <section className="card comms-panel">
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">Raport utilizare comunicare</h2>
          <p className="comms-toolbar-hint">
            Perioadă: {new Date(data.period.from).toLocaleDateString("ro-RO")} –{" "}
            {new Date(data.period.to).toLocaleDateString("ro-RO")}
          </p>
        </div>
        <FieldSelect
          id="usage-period"
          label="Interval"
          value={period}
          onChange={(value) => setPeriod(value as PeriodKey)}
          options={[
            { value: "7", label: "Ultimele 7 zile" },
            { value: "30", label: "Ultimele 30 zile" },
            { value: "90", label: "Ultimele 90 zile" }
          ]}
        />
      </div>

      <div className="comms-kpi" aria-label="Indicatori comunicare">
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
          <span>Angajați care au citit</span>
          <strong>{data.totals.readRatePercent}%</strong>
        </div>
        <div>
          <span>Remindere trimise</span>
          <strong>{data.totals.remindersSentInPeriod}</strong>
        </div>
        <div>
          <span>Reacții</span>
          <strong>{data.totals.reactionsInPeriod}</strong>
        </div>
        <div>
          <span>Răspunsuri anunțuri</span>
          <strong>{data.totals.announcementAnswersInPeriod}</strong>
        </div>
        <div>
          <span>Mesaje chat</span>
          <strong>{data.totals.chatMessagesInPeriod}</strong>
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

      {data.announcementsByContentType.length ? (
        <>
          <h3 className="comms-detail-section-title">Anunțuri după tip conținut</h3>
          <ul className="comms-usage-modules">
            {data.announcementsByContentType.map((row) => (
              <li key={row.contentType}>
                <span>
                  {CONTENT_TYPE_LABELS[row.contentType as keyof typeof CONTENT_TYPE_LABELS] ?? row.contentType}
                </span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {data.auditEventsByModule.length ? (
        <>
          <h3 className="comms-detail-section-title">Evenimente audit pe modul</h3>
          <ul className="comms-usage-modules">
            {data.auditEventsByModule.map((row) => (
              <li key={row.module}>
                <span>{row.module}</span>
                <strong>{row.events}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="field-hint comms-usage-note">
        Raportul este disponibil doar ca indicatori în aplicație. Nu există export PDF sau Excel pentru utilizarea
        comunicării.
      </p>
    </section>
  );
}
