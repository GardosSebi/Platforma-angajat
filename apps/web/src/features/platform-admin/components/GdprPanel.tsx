import { FormEvent, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import { platformAdminApi } from "../api/platform-admin.api";
import { useAuditLogs, useEraseDsar, useGdprOverview } from "../hooks/usePlatformAdmin";

const AUDIT_MODULE_OPTIONS = [
  { value: "", label: "Toate modulele" },
  { value: "RETENTION", label: "Retenție" },
  { value: "GDPR", label: "GDPR / DSAR" },
  { value: "AUTH", label: "Autentificare" },
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
  const eraseDsar = useEraseDsar();
  const [dsarEmployeeId, setDsarEmployeeId] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [dsarFeedback, setDsarFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const overview = overviewQuery.data;
  const paged = paginationFromResult(logsQuery.data, pagination.page, pagination.pageSize);
  const exportEnabled = overview?.policy.dsarExportEnabled ?? false;
  const eraseEnabled = overview?.policy.dsarEraseEnabled ?? false;
  const dsarBusy = exportPending || eraseDsar.isPending;

  const onExport = async () => {
    if (!dsarEmployeeId || !exportEnabled) return;
    setDsarFeedback(null);
    setExportPending(true);
    try {
      await downloadWithAuth(platformAdminApi.dsarExportUrl(dsarEmployeeId), `dsar-${dsarEmployeeId}.zip`);
      setDsarFeedback({ type: "success", message: "Arhiva DSAR a fost descărcată. Acțiunea este jurnalizată." });
    } catch (error) {
      setDsarFeedback({ type: "error", message: mutationErrorMessage(error) });
    } finally {
      setExportPending(false);
    }
  };

  const onErase = (event: FormEvent) => {
    event.preventDefault();
    if (!dsarEmployeeId || !eraseEnabled) return;
    setDsarFeedback(null);
    eraseDsar.mutate(
      {
        employeeId: dsarEmployeeId,
        payload: { confirmEmail: confirmEmail.trim(), confirmPhrase: confirmPhrase.trim() }
      },
      {
        onSuccess: (result) => {
          setConfirmEmail("");
          setConfirmPhrase("");
          setDsarFeedback({
            type: "success",
            message: `Identitatea a fost anonimizată. Păstrate: ${result.retainedCategories.join(", ")}.`
          });
        },
        onError: (error) => setDsarFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

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
              <li>
                Export DSAR (Art. 15): {overview.policy.dsarExportEnabled ? "disponibil pentru administratori" : "oprit"}
              </li>
              <li>
                Ștergere/anonimizare DSAR (Art. 17):{" "}
                {overview.policy.dsarEraseEnabled
                  ? "disponibilă; evidențele SSM obligatorii legal rămân păstrate"
                  : "oprită"}
              </li>
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

      <section className="card form-stack">
        <h3 className="card-title">Cerere persoană vizată (DSAR)</h3>
        <p className="page-lead">
          Exportul include identitatea, contul, SSM, tichete, sondaje, comunicări și copii de fișiere atașate. Ștergerea
          anonimizează identitatea și contactul; nu șterge instruiri, medicina muncii, EIP, accidente sau jurnalul de
          audit (excepție Art. 17(3)(b)).
        </p>
        <EmployeeSelect
          id="dsar-employee"
          label="Persoana vizată"
          value={dsarEmployeeId}
          onChange={(value) => {
            setDsarEmployeeId(value);
            setDsarFeedback(null);
          }}
          allowEmpty
          includeInactive
          emptyLabel="Selectează angajatul"
          disabled={dsarBusy}
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={!dsarEmployeeId || !exportEnabled || dsarBusy}
            onClick={() => void onExport()}
          >
            {exportPending ? "Se pregătește arhiva…" : "Descarcă totul despre mine"}
          </button>
        </div>
        <form className="form-stack" onSubmit={onErase}>
          <div className="field">
            <label htmlFor="dsar-email">Confirmă e-mailul persoanei</label>
            <input
              id="dsar-email"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              disabled={dsarBusy}
              onChange={(event) => setConfirmEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="dsar-phrase">Confirmare ștergere</label>
            <input
              id="dsar-phrase"
              value={confirmPhrase}
              disabled={dsarBusy}
              placeholder="Scrie STERGE"
              onChange={(event) => setConfirmPhrase(event.target.value)}
              required
            />
            <p className="field-hint">Pentru a continua, scrie exact STERGE. Nu poți anonimiza propriul cont.</p>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn-secondary btn-danger"
              disabled={!dsarEmployeeId || !eraseEnabled || dsarBusy}
            >
              {eraseDsar.isPending ? "Se anonimizează…" : "Șterge-mă (anonimizează identitatea)"}
            </button>
          </div>
        </form>
        {dsarFeedback ? <p className={`feedback ${dsarFeedback.type}`}>{dsarFeedback.message}</p> : null}
      </section>

      {overview?.recentRetentionEvents.length ? (
        <section className="card">
          <h3 className="card-title">Jurnal retenție și DSAR</h3>
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
          Acțiuni înregistrate pe tenant, inclusiv DSAR_EXPORT, DSAR_ERASE și modificări SSO.
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
