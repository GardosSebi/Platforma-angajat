import { useState } from "react";
import type { SsmReportType } from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../api/ssm.api";
import { useSsmReport } from "../hooks/useSsmOverview";

const REPORT_TYPES: Array<{ type: SsmReportType; label: string; shortLabel: string; description: string }> = [
  { type: "trainings", label: "Instruiri", shortLabel: "Instruiri", description: "Planuri, statusuri, scadențe, scoruri." },
  { type: "eip", label: "EIP", shortLabel: "EIP", description: "Mișcări, distribuții, scadențe înlocuire." },
  { type: "medical", label: "Medicina muncii", shortLabel: "Medical", description: "Controale, rezultate, următoare scadențe." },
  {
    type: "documents",
    label: "Documente & versiuni",
    shortLabel: "Documente",
    description: "Documente, versiuni, fișiere și motiv actualizare."
  }
];

const REPORT_PREVIEW_FIELDS: Record<SsmReportType, string[]> = {
  trainings: ["employee", "trainingCode", "trainingName", "status", "dueAt", "score"],
  eip: ["employee", "eipCode", "eipName", "movementType", "movementDate", "replacementDueAt"],
  medical: ["employee", "controlCode", "controlName", "result", "nextDueAt", "validityUntil"],
  documents: ["title", "type", "status", "versionNumber", "activeVersionNumber", "fileName", "changeNote", "versionCreatedAt"]
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

export function SsmReportsManager() {
  const [selectedType, setSelectedType] = useState<SsmReportType>("trainings");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const reportQuery = useSsmReport(selectedType);
  const rows = reportQuery.data?.rows ?? [];
  const headers = REPORT_PREVIEW_FIELDS[selectedType].filter((header) => rows.some((row) => header in row));
  const selectedReport = REPORT_TYPES.find((item) => item.type === selectedType);

  const download = async (format: "pdf" | "excel") => {
    setDownloadError(null);
    const path = format === "pdf" ? ssmApi.getSsmReportPdfUrl(selectedType) : ssmApi.getSsmReportExcelUrl(selectedType);
    const extension = format === "pdf" ? "pdf" : "xls";
    try {
      await downloadWithAuth(path, `ssm-${selectedType}-report.${extension}`);
    } catch (error) {
      setDownloadError(mutationErrorMessage(error));
    }
  };

  return (
    <section className="ssm-documents ssm-reports-section" aria-labelledby="ssm-reports-title">
      <div className="ssm-module-hero ssm-reports-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea K · 3.11</p>
          <h2 id="ssm-reports-title" className="card-title">
            Rapoarte & export documente
          </h2>
          <p className="ssm-hero-lead">
            Raportul de documente/versionare este selectat implicit. Verifică versiunile și exportă PDF sau Excel fără să iasă din pagină.
          </p>
          <div className="ssm-badge-row">
            <span className="ssm-chip">PDF</span>
            <span className="ssm-chip">Excel</span>
            <span className="ssm-chip">Read-only inspector</span>
          </div>
        </div>

        <div className="ssm-summary-strip">
          <div className="ssm-stat-card">
            <span>Raport</span>
            <strong>{selectedReport?.shortLabel}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Rânduri</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Preview</span>
            <strong>{Math.min(rows.length, 20)}</strong>
          </div>
        </div>
      </div>

      <div className="ssm-report-layout">
        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Tip raport</h3>
              <p className="field-hint">Schimbă contextul fără să părăsești pagina.</p>
            </div>
          </div>
          <div className="ssm-doc-items">
            {REPORT_TYPES.map((report) => (
              <button
                key={report.type}
                type="button"
                className={`ssm-doc-item ${selectedType === report.type ? "selected" : ""}`}
                onClick={() => setSelectedType(report.type)}
              >
                <strong>{report.label}</strong>
                <span>{report.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Export și preview</h3>
              <p className="field-hint">
                {selectedReport?.label}: {selectedReport?.description}
              </p>
            </div>
            <div className="ssm-inline-actions">
              <button type="button" className="btn-secondary" onClick={() => void download("pdf")}>
                Export PDF
              </button>
              <button type="button" className="btn-secondary" onClick={() => void download("excel")}>
                Export Excel
              </button>
            </div>
          </div>

          {downloadError ? (
            <p className="feedback error" role="alert">
              {downloadError}
            </p>
          ) : null}
          {reportQuery.isLoading ? <p className="field-hint">Se încarcă raportul...</p> : null}

          <div className="ssm-doc-items ssm-report-preview">
            {rows.slice(0, 20).map((row, index) => (
              <article key={index} className={`ssm-doc-item ssm-report-row ${selectedType === "documents" ? "documents" : ""}`}>
                <strong>
                  {selectedType === "documents"
                    ? `${formatReportValue(row.title)} · v${formatReportValue(row.versionNumber)}`
                    : `Înregistrare #${index + 1}`}
                </strong>
                <div className="ssm-report-fields">
                  {headers.map((header) => (
                    <div key={header} className="ssm-report-field">
                      <span>{header}</span>
                      <strong>{formatReportValue(row[header])}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!reportQuery.isLoading && rows.length === 0 ? <p className="field-hint">Raportul nu are rânduri.</p> : null}
          </div>

          <p className="field-hint">Acces inspector read-only poate folosi aceleași endpoint-uri cu permisiuni limitate.</p>
        </div>
      </div>
    </section>
  );
}
