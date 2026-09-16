import { useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import { useAuditLogs, useGdprOverview } from "../hooks/usePlatformAdmin";

const AUDIT_MODULE_OPTIONS = [
  { value: "", label: "Toate modulele" },
  { value: "RETENTION", label: "Retenție" },
  { value: "COMMUNICATIONS", label: "Comunicări" },
  { value: "SSM", label: "SSM" },
  { value: "SURVEYS", label: "Sondaje" },
  { value: "TICKETING", label: "Tichete" },
  { value: "MASTER_DATA", label: "Date master" },
  { value: "HTTP", label: "HTTP / fișiere" }
];

export function GdprPanel() {
  const overviewQuery = useGdprOverview();
  const pagination = usePagination();
  const [moduleFilter, setModuleFilter] = useState("");
  const logsQuery = useAuditLogs({
    page: pagination.page,
    pageSize: pagination.pageSize,
    module: moduleFilter || undefined
  });
  const overview = overviewQuery.data;
  const paged = paginationFromResult(logsQuery.data, pagination.page, pagination.pageSize);

  return (
    <div className="form-stack">
      <section className="card form-stack">
        <h2 className="card-title">GDPR — audit și retenție</h2>
        {overviewQuery.isLoading ? <p className="field-hint">Se încarcă politica de retenție…</p> : null}
        {overviewQuery.isError ? (
          <p className="feedback error">{mutationErrorMessage(overviewQuery.error)}</p>
        ) : null}
        {overview ? (
          <>
            <p className="page-lead">
              Datele și fișierele sunt păstrate <strong>{overview.policy.retentionYears} ani</strong>. Accesul la
              fișierele vechi (marcate după această perioadă) este jurnalizat. Data de referință actuală:{" "}
              {new Date(overview.cutoff).toLocaleDateString("ro-RO")}.
            </p>
            <ul className="gdpr-policy-list">
              <li>Audit acțiuni și acces la fișiere arhivate: activ</li>
              <li>Retenție istorică: {overview.policy.retentionYears} ani, fără ștergere automată</li>
              <li>Fluxuri DSAR (export sau ștergere la cererea persoanei vizate): nu sunt disponibile în platformă</li>
            </ul>
            <div className="gdpr-archived-grid" aria-label="Înregistrări marcate pentru retenție">
              {overview.archivedCounts.map((row) => (
                <div key={row.category}>
                  <span>{row.category}</span>
                  <strong>{row.archived}</strong>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {overview?.recentRetentionEvents.length ? (
        <section className="card">
          <h3 className="card-title">Jurnal retenție (fișiere vechi)</h3>
          <ul className="gdpr-audit-list">
            {overview.recentRetentionEvents.map((row) => (
              <li key={row.id}>
                <strong>
                  {row.action} · {row.entityType}
                </strong>
                <span className="gdpr-audit-meta">
                  {row.actorName ?? row.actorEmail ?? row.actorId} ·{" "}
                  {new Date(row.createdAt).toLocaleString("ro-RO")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card form-stack">
        <h3 className="card-title">Jurnal audit</h3>
        <p className="field-hint">
          Acțiuni înregistrate pe tenant. Nu există export sau ștergere a datelor personale la cerere (DSAR).
        </p>
        <FieldSelect
          id="audit-module"
          label="Modul"
          value={moduleFilter}
          onChange={(value) => {
            setModuleFilter(value);
            pagination.setPage(1);
          }}
          options={AUDIT_MODULE_OPTIONS}
        />
        {logsQuery.isLoading ? <p className="field-hint">Se încarcă jurnalul…</p> : null}
        {logsQuery.isError ? <p className="feedback error">{mutationErrorMessage(logsQuery.error)}</p> : null}
        <ul className="gdpr-audit-list">
          {paged.items.map((row) => (
            <li key={row.id}>
              <strong>
                {row.module} · {row.action}
              </strong>
              <span>
                {row.entityType} {row.entityId !== "batch" && row.entityId !== "-" ? `· ${row.entityId}` : ""}
              </span>
              <span className="gdpr-audit-meta">
                {row.actorName ?? row.actorEmail ?? row.actorId} · {new Date(row.createdAt).toLocaleString("ro-RO")}
              </span>
            </li>
          ))}
        </ul>
        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          disabled={logsQuery.isFetching}
        />
      </section>
    </div>
  );
}
