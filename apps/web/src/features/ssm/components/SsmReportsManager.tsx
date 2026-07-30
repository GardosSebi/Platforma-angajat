import { useMemo, useState } from "react";
import type { SsmDocumentReportIssue, SsmReportFilters, SsmReportType } from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import {
  useDepartmentsLookup,
  useLegalEntitiesLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import { useScheduledReports, useSsmReport } from "../hooks/useSsmOverview";
import { SsmScheduledReportsPanel } from "./SsmScheduledReportsPanel";

type ReportsTab = "generate" | "scheduled";

const PAGE_TABS: Array<{ id: ReportsTab; title: string; caption: string }> = [
  { id: "generate", title: "Generare", caption: "Preview și export" },
  { id: "scheduled", title: "Programate", caption: "Trimitere automată" }
];

const REPORT_TYPES: Array<{ type: SsmReportType; label: string; shortLabel: string; description: string }> = [
  {
    type: "trainings",
    label: "Instruiri",
    shortLabel: "Instruiri",
    description: "Angajat, departament, entitate, tematică, rezultat."
  },
  {
    type: "eip",
    label: "EIP · mișcări",
    shortLabel: "EIP",
    description: "Distribuiri și scadențe înlocuire."
  },
  {
    type: "eip-stock",
    label: "EIP · stoc",
    shortLabel: "EIP stoc",
    description: "Necesar, stoc pe mână, lipsă."
  },
  {
    type: "medical",
    label: "Medicina muncii",
    shortLabel: "Medical",
    description: "Controale pe angajat."
  },
  {
    type: "documents",
    label: "Documente",
    shortLabel: "Documente",
    description: "Versionare, expirate, fără revizuire."
  },
  {
    type: "accidents",
    label: "Accidente",
    shortLabel: "Accidente",
    description: "Registru incidente și boli."
  },
  { type: "psi", label: "PSI", shortLabel: "PSI", description: "Echipamente și instruiri PSI." },
  {
    type: "compliance",
    label: "Conformitate",
    shortLabel: "Conformitate",
    description: "KPI și breakdown pe module."
  }
];

const FIELD_LABELS: Record<string, string> = {
  employee: "Angajat",
  department: "Departament",
  worksite: "Punct lucru",
  legalEntity: "Entitate",
  trainingCode: "Cod",
  trainingName: "Tematică",
  status: "Status",
  result: "Rezultat",
  dueAt: "Scadență",
  score: "Scor",
  eipCode: "Cod EIP",
  eipName: "EIP",
  eipType: "Tip EIP",
  movementType: "Mișcare",
  movementDate: "Data",
  replacementDueAt: "Înlocuire",
  required: "Necesar",
  distributedActive: "Distribuit",
  stockOnHand: "Stoc",
  shortage: "Lipsă",
  controlCode: "Cod",
  controlName: "Control",
  nextDueAt: "Următoarea",
  validityUntil: "Valabil până",
  title: "Titlu",
  type: "Tip",
  periodEnd: "Expiră",
  activeVersionNumber: "Versiune",
  isExpired: "Expirat",
  needsReview: "Necesită revizuire",
  fileName: "Fișier",
  severity: "Severitate",
  occurredAt: "Data",
  location: "Locație",
  category: "Categorie",
  name: "Denumire",
  validUntil: "Valabil",
  globalScore: "Scor global",
  trafficLight: "Semafor",
  module: "Modul",
  total: "Total",
  noncompliant: "Neconforme"
};

const REPORT_PREVIEW_FIELDS: Record<SsmReportType, string[]> = {
  trainings: [
    "employee",
    "department",
    "legalEntity",
    "trainingCode",
    "trainingName",
    "status",
    "result",
    "dueAt",
    "score"
  ],
  eip: [
    "employee",
    "department",
    "legalEntity",
    "eipCode",
    "eipName",
    "movementType",
    "movementDate",
    "replacementDueAt"
  ],
  "eip-stock": ["eipType", "worksite", "department", "required", "distributedActive", "stockOnHand", "shortage"],
  medical: [
    "employee",
    "department",
    "legalEntity",
    "controlCode",
    "controlName",
    "result",
    "nextDueAt",
    "validityUntil"
  ],
  documents: [
    "title",
    "type",
    "status",
    "legalEntity",
    "periodEnd",
    "activeVersionNumber",
    "isExpired",
    "needsReview",
    "fileName"
  ],
  accidents: ["title", "type", "severity", "status", "employee", "occurredAt", "location", "worksite", "department"],
  psi: ["category", "name", "worksite", "nextDueAt", "validUntil", "employee"],
  compliance: ["globalScore", "trafficLight", "module", "total", "noncompliant", "score"]
};

type FilterState = {
  legalEntityId: string;
  worksiteId: string;
  departmentId: string;
  employeeId: string;
  from: string;
  to: string;
  docIssue: SsmDocumentReportIssue;
};

const EMPTY_FILTERS: FilterState = {
  legalEntityId: "",
  worksiteId: "",
  departmentId: "",
  employeeId: "",
  from: "",
  to: "",
  docIssue: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  return String(value);
}

function toApiFilters(filters: FilterState): SsmReportFilters {
  return {
    legalEntityId: filters.legalEntityId || undefined,
    worksiteId: filters.worksiteId || undefined,
    departmentId: filters.departmentId || undefined,
    employeeId: filters.employeeId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    docIssue: filters.docIssue || undefined
  };
}

function rowTitle(type: SsmReportType, row: Record<string, unknown>, index: number): string {
  if (type === "documents") {
    return `${formatReportValue(row.title)} · v${formatReportValue(row.activeVersionNumber)}`;
  }
  if (type === "trainings") {
    return `${formatReportValue(row.employee)} · ${formatReportValue(row.trainingName)}`;
  }
  if (type === "eip") {
    return `${formatReportValue(row.employee)} · ${formatReportValue(row.eipName)}`;
  }
  if (type === "eip-stock") {
    return `${formatReportValue(row.eipType)} · lipsă ${formatReportValue(row.shortage)}`;
  }
  if (type === "medical") {
    return `${formatReportValue(row.employee)} · ${formatReportValue(row.controlName)}`;
  }
  if (type === "accidents") {
    return `${formatReportValue(row.title)} · ${formatReportValue(row.severity)}`;
  }
  if (type === "psi") {
    return `${formatReportValue(row.category)} · ${formatReportValue(row.name)}`;
  }
  if (type === "compliance") {
    return row.module
      ? `${formatReportValue(row.module)} · ${formatReportValue(row.score)}%`
      : `KPI global · ${formatReportValue(row.globalScore)}%`;
  }
  return `Înregistrare #${index + 1}`;
}

export function SsmReportsManager() {
  const [tab, setTab] = useState<ReportsTab>("generate");
  const [selectedType, setSelectedType] = useState<SsmReportType>("trainings");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const reportQuery = useSsmReport(selectedType, apiFilters);
  const schedulesQuery = useScheduledReports();
  const legalEntities = useLegalEntitiesLookup();
  const worksites = useWorksitesLookup();
  const departments = useDepartmentsLookup();

  const activeTabMeta = PAGE_TABS.find((item) => item.id === tab) ?? PAGE_TABS[0];
  const selectedReport = REPORT_TYPES.find((item) => item.type === selectedType);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const rows = reportQuery.data?.rows ?? [];
  const headers = REPORT_PREVIEW_FIELDS[selectedType].filter((header) => rows.some((row) => header in row));
  const scheduledCount = schedulesQuery.data?.length ?? 0;

  const worksiteOptions = useMemo(() => {
    const items = worksites.data?.items ?? [];
    return filters.legalEntityId
      ? items.filter((item) => item.legalEntityId === filters.legalEntityId)
      : items;
  }, [filters.legalEntityId, worksites.data?.items]);

  const departmentOptions = useMemo(() => {
    const items = departments.data?.items ?? [];
    return filters.worksiteId ? items.filter((item) => item.worksiteId === filters.worksiteId) : items;
  }, [departments.data?.items, filters.worksiteId]);

  const patchFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.legalEntityId !== undefined) {
        next.worksiteId = "";
        next.departmentId = "";
      }
      if (patch.worksiteId !== undefined) {
        next.departmentId = "";
      }
      return next;
    });
  };

  const download = async (format: "pdf" | "excel") => {
    setDownloadError(null);
    setDownloading(format);
    const path =
      format === "pdf"
        ? ssmApi.getSsmReportPdfUrl(selectedType, apiFilters)
        : ssmApi.getSsmReportExcelUrl(selectedType, apiFilters);
    const extension = format === "pdf" ? "pdf" : "xlsx";
    try {
      await downloadWithAuth(path, `ssm-${selectedType}-report.${extension}`);
    } catch (error) {
      setDownloadError(mutationErrorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="ssm-eip-panel ssm-reports-panel" aria-label="Rapoarte și export SSM">
      <div className="ssm-training-metrics ssm-overview-metrics" aria-label="Indicatori rapoarte">
        <div>
          <dt>Raport</dt>
          <dd>{selectedReport?.shortLabel ?? "—"}</dd>
        </div>
        <div>
          <dt>Rânduri</dt>
          <dd>{tab === "generate" ? rows.length : "—"}</dd>
        </div>
        <div>
          <dt>Filtre</dt>
          <dd>{activeFilterCount || "—"}</dd>
        </div>
        <div>
          <dt>Programate</dt>
          <dd>{scheduledCount}</dd>
        </div>
      </div>

      <div className="ssm-panel-tabs ssm-panel-tabs--2" role="tablist" aria-label="Secțiuni rapoarte">
        {PAGE_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ssm-panel-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </button>
        ))}
      </div>

      <header className="ssm-panel-header ssm-overview-toolbar">
        <div>
          <h3 className="card-title">{activeTabMeta.title}</h3>
          <p className="field-hint">{activeTabMeta.caption}</p>
        </div>
        {tab === "generate" ? (
          <div className="ssm-inline-actions">
            <button
              type="button"
              className={`btn-secondary${showFilters || activeFilterCount ? " is-active-filter" : ""}`}
              onClick={() => setShowFilters((value) => !value)}
            >
              Filtre{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={downloading !== null}
              onClick={() => void download("pdf")}
            >
              {downloading === "pdf" ? "PDF…" : "Export PDF"}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={downloading !== null}
              onClick={() => void download("excel")}
            >
              {downloading === "excel" ? "Excel…" : "Export Excel"}
            </button>
          </div>
        ) : null}
      </header>

      {tab === "generate" ? (
        <>
          {showFilters ? (
            <div className="card form-stack ssm-doc-card ssm-overview-filters">
              <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                <h4 className="card-title" style={{ margin: 0 }}>
                  Filtre active
                </h4>
                <button type="button" className="btn-text" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Resetează
                </button>
              </div>
              <div className="ssm-filter-grid">
                <FieldSelect
                  id="rep-legal-entity"
                  label="Entitate"
                  value={filters.legalEntityId}
                  onChange={(legalEntityId) => patchFilter({ legalEntityId })}
                  allowEmpty
                  emptyLabel="Toate entitățile"
                  options={mapToOptions(
                    legalEntities.data?.items ?? [],
                    (item) => item.id,
                    (item) => `${item.code} — ${item.name}`
                  )}
                />
                <FieldSelect
                  id="rep-worksite"
                  label="Punct de lucru"
                  value={filters.worksiteId}
                  onChange={(worksiteId) => patchFilter({ worksiteId })}
                  allowEmpty
                  emptyLabel="Toate punctele"
                  options={mapToOptions(
                    worksiteOptions,
                    (item) => item.id,
                    (item) => `${item.code} — ${item.name}`
                  )}
                />
                <FieldSelect
                  id="rep-department"
                  label="Departament"
                  value={filters.departmentId}
                  onChange={(departmentId) => patchFilter({ departmentId })}
                  allowEmpty
                  emptyLabel="Toate departamentele"
                  options={mapToOptions(
                    departmentOptions,
                    (item) => item.id,
                    (item) => `${item.code} — ${item.name}`
                  )}
                />
                <EmployeeSelect
                  id="rep-employee"
                  label="Angajat"
                  value={filters.employeeId}
                  onChange={(employeeId) => patchFilter({ employeeId })}
                  allowEmpty
                  emptyLabel="Toți angajații"
                />
                <label className="field">
                  <span>De la</span>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => patchFilter({ from: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Până la</span>
                  <input type="date" value={filters.to} onChange={(e) => patchFilter({ to: e.target.value })} />
                </label>
                {selectedType === "documents" ? (
                  <FieldSelect
                    id="rep-doc-issue"
                    label="Probleme documente"
                    value={filters.docIssue}
                    onChange={(docIssue) => patchFilter({ docIssue: docIssue as SsmDocumentReportIssue })}
                    allowEmpty
                    emptyLabel="Toate documentele"
                    options={[
                      { value: "expired", label: "Doar expirate" },
                      { value: "needsReview", label: "Fără revizuire / expirate" }
                    ]}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="ssm-training-subtabs ssm-reports-type-tabs" role="tablist" aria-label="Tip raport">
            {REPORT_TYPES.map((report) => (
              <button
                key={report.type}
                type="button"
                role="tab"
                aria-selected={selectedType === report.type}
                className={`ssm-training-tab ${selectedType === report.type ? "active" : ""}`}
                onClick={() => setSelectedType(report.type)}
              >
                {report.shortLabel}
              </button>
            ))}
          </div>

          <div className="ssm-panel-layout ssm-reports-generate-layout">
            <div className="card form-stack ssm-doc-card">
              <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                <h4 className="card-title" style={{ margin: 0 }}>
                  {selectedReport?.label}
                </h4>
                <span className="ssm-chip">{rows.length}</span>
              </div>
              <p className="field-hint" style={{ marginTop: 0 }}>
                {selectedReport?.description}
              </p>
              {downloadError ? (
                <p className="feedback error" role="alert">
                  {downloadError}
                </p>
              ) : null}
              {reportQuery.isLoading ? <p className="field-hint">Se încarcă raportul…</p> : null}

              <div className="ssm-history-list ssm-report-preview">
                {rows.slice(0, 25).map((row, index) => (
                  <div key={index} className="ssm-history-item ssm-report-history-item">
                    <div>
                      <strong>{rowTitle(selectedType, row, index)}</strong>
                      <div className="ssm-report-meta">
                        {headers.slice(0, 4).map((header) => (
                          <span key={header}>
                            {FIELD_LABELS[header] ?? header}: {formatReportValue(row[header])}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!reportQuery.isLoading && rows.length === 0 ? (
                  <p className="field-hint">Raportul nu are rânduri pentru filtrele curente.</p>
                ) : null}
              </div>
              {rows.length > 25 ? (
                <p className="field-hint">Preview: primele 25 din {rows.length}. Exportul include toate rândurile.</p>
              ) : null}
            </div>

            <div className="card form-stack ssm-doc-card">
              <h4 className="card-title" style={{ margin: 0 }}>
                Detalii rânduri
              </h4>
              <p className="field-hint" style={{ marginTop: 0 }}>
                Câmpurile din preview pentru tipul selectat.
              </p>
              <div className="ssm-history-list">
                {headers.map((header) => (
                  <div key={header} className="ssm-history-item">
                    <div>
                      <strong>{FIELD_LABELS[header] ?? header}</strong>
                      <div className="field-hint">
                        Exemplu: {rows[0] ? formatReportValue(rows[0][header]) : "—"}
                      </div>
                    </div>
                  </div>
                ))}
                {!headers.length ? <p className="field-hint">Nu există coloane de afișat.</p> : null}
              </div>
              <div className="ssm-overview-quick">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={downloading !== null}
                  onClick={() => void download("pdf")}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={downloading !== null}
                  onClick={() => void download("excel")}
                >
                  Excel
                </button>
                <button type="button" className="btn-text" onClick={() => setTab("scheduled")}>
                  Programează trimiterea
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <SsmScheduledReportsPanel embedded />
      )}
    </section>
  );
}
