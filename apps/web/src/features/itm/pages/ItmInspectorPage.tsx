import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SsmReportType } from "@repo/shared-types/ssm";
import { downloadWithAuth, fetchBlobWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../../ssm/api/ssm.api";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useSsmComplianceDashboard } from "../../ssm/hooks/useSsmOverview";

type Tab = "control" | "dossiers" | "accidents" | "reports" | "visits" | "gdpr";

const DOC_TYPE_LABELS: Record<string, string> = {
  IPSSM: "IPSSM",
  RISK_ASSESSMENT: "Evaluare risc",
  PPP: "PPP",
  THEMATIC: "Tematic",
  DECISION: "Decizie",
  PSI: "PSI / SU",
  REGISTER: "Registru",
  EXPOSURE_SHEET: "Fișă expunere",
  EIP_NORM: "Normativ EIP",
  OTHER: "Altele"
};

const ITM_REPORTS: Array<{ type: SsmReportType; label: string }> = [
  { type: "compliance", label: "Conformitate" },
  { type: "trainings", label: "Instruiri" },
  { type: "medical", label: "Medicina muncii" },
  { type: "eip", label: "EIP" },
  { type: "documents", label: "Documente" },
  { type: "accidents", label: "Accidente" },
  { type: "psi", label: "PSI" }
];

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function actionLabel(action: string): string {
  switch (action) {
    case "DOWNLOAD":
      return "Descărcare";
    case "VIEW":
      return "Vizualizare";
    case "EXPORT":
      return "Export pachet";
    case "VISIT_START":
      return "Deschidere vizită";
    case "VISIT_CLOSE":
      return "Închidere vizită";
    default:
      return action;
  }
}

function DocumentPreviewModal({
  documentId,
  title,
  mimeType,
  onClose
}: {
  documentId: string;
  title: string;
  mimeType?: string;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBlobWithAuth(ssmApi.getItmDocumentFileUrl(documentId, "preview"))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Documentul nu s-a putut deschide.");
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId]);

  const isPdf = (mimeType ?? "").includes("pdf");
  const isImage = (mimeType ?? "").startsWith("image/");

  return (
    <div className="itm-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="itm-preview-title">
      <div className="itm-preview-modal">
        <header className="itm-preview-head">
          <h2 id="itm-preview-title" className="card-title">
            {title}
          </h2>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Închide
          </button>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {!objectUrl && !error ? <p className="field-hint">Se încarcă documentul semnat…</p> : null}
        {objectUrl && isPdf ? <iframe title={title} src={objectUrl} className="itm-preview-frame" /> : null}
        {objectUrl && isImage ? <img src={objectUrl} alt={title} className="itm-preview-image" /> : null}
        {objectUrl && !isPdf && !isImage ? (
          <p className="field-hint">Previzualizarea în pagină e disponibilă pentru PDF și imagini. Descarcă fișierul pentru restul formatelor.</p>
        ) : null}
      </div>
    </div>
  );
}

export function ItmInspectorPage() {
  const session = useAuthSession();
  const roles = session?.roles ?? [];
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("control");
  const [worksiteId, setWorksiteId] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [preview, setPreview] = useState<{ id: string; title: string; mimeType?: string } | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [reportType, setReportType] = useState<SsmReportType>("compliance");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedEmployeeSearch(employeeSearch.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [employeeSearch]);

  const worksitesQuery = useQuery({
    queryKey: ["itm", "worksites"],
    queryFn: () => ssmApi.listItmWorksites()
  });

  const controlQuery = useQuery({
    queryKey: ["itm", "control", worksiteId || "all"],
    queryFn: () => ssmApi.getItmControl(worksiteId || undefined),
    enabled: tab === "control"
  });

  const complianceQuery = useSsmComplianceDashboard({ worksiteId: worksiteId || undefined });

  const accidentsQuery = useQuery({
    queryKey: ["itm", "accidents"],
    queryFn: () => ssmApi.listAccidentCases({ page: 1, pageSize: 50 }),
    enabled: tab === "accidents" && hasPermission(roles, "ssm:accident:view")
  });

  const visitsQuery = useQuery({
    queryKey: ["itm", "visits", worksiteId || "all"],
    queryFn: () => ssmApi.listItmVisits(worksiteId || undefined),
    enabled: tab === "visits"
  });

  const logsQuery = useQuery({
    queryKey: ["itm", "access-logs"],
    queryFn: () => ssmApi.listItmAccessLogs(),
    enabled: tab === "gdpr"
  });

  const employeesQuery = useQuery({
    queryKey: ["itm", "employees", debouncedEmployeeSearch, worksiteId || "all"],
    queryFn: () => ssmApi.listItmEmployees(debouncedEmployeeSearch || undefined, worksiteId || undefined),
    enabled: tab === "dossiers"
  });

  const dossierQuery = useQuery({
    queryKey: ["itm", "dossier", selectedEmployeeId],
    queryFn: () => ssmApi.getItmEmployeeDossier(selectedEmployeeId),
    enabled: tab === "dossiers" && Boolean(selectedEmployeeId)
  });

  const reportFilters = useMemo(() => ({ worksiteId: worksiteId || undefined }), [worksiteId]);
  const reportQuery = useQuery({
    queryKey: ["itm", "report", reportType, worksiteId || "all"],
    queryFn: () => ssmApi.ssmReport(reportType, reportFilters),
    enabled: tab === "reports"
  });

  const startVisit = useMutation({
    mutationFn: () => ssmApi.startItmVisit({ worksiteId: worksiteId || undefined, notes: visitNotes || undefined }),
    onSuccess: async () => {
      setVisitNotes("");
      await queryClient.invalidateQueries({ queryKey: ["itm", "visits"] });
    }
  });

  const closeVisit = useMutation({
    mutationFn: (visitId: string) => ssmApi.closeItmVisit(visitId, visitNotes || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["itm", "visits"] });
    }
  });

  const canExport = hasPermission(roles, "ssm:reports:export");
  const worksites = worksitesQuery.data?.items ?? [];
  const filteredAccidents = useMemo(() => {
    const items = accidentsQuery.data?.items ?? [];
    if (!worksiteId) return items;
    return items.filter((item) => item.worksiteId === worksiteId);
  }, [accidentsQuery.data?.items, worksiteId]);

  const controlFolders = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return (controlQuery.data?.folders ?? []).map((folder) => ({
      ...folder,
      documents: q
        ? folder.documents.filter((doc) =>
            `${doc.title} ${doc.targetLabel ?? ""} ${doc.activeVersion?.fileName ?? ""}`.toLowerCase().includes(q)
          )
        : folder.documents
    })).filter((folder) => folder.documents.length > 0 || !q);
  }, [controlQuery.data?.folders, docSearch]);

  const runDownload = (path: string, filename: string) => {
    setDownloadError(null);
    void downloadWithAuth(path, filename).catch((e) =>
      setDownloadError(e instanceof Error ? e.message : "Descărcare eșuată.")
    );
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Portal inspector ITM / ISU</h1>
        <p className="page-subtitle">
          Acces doar în citire la documentele semnate, dosarele angajaților și rapoartele de control. Fiecare
          vizualizare sau descărcare este jurnalizată GDPR.
        </p>
      </header>

      <FieldSelect
        id="itm-worksite"
        label="Filtrare punct de lucru"
        value={worksiteId}
        onChange={setWorksiteId}
        allowEmpty
        emptyLabel="Toate punctele de lucru"
        options={mapToOptions(
          worksites,
          (item) => item.id,
          (item) => `${item.code} — ${item.name}`
        )}
      />

      <nav className="tab-bar" aria-label="Secțiuni ITM">
        <button type="button" className={tab === "control" ? "active" : undefined} onClick={() => setTab("control")}>
          Dosar control
        </button>
        <button type="button" className={tab === "dossiers" ? "active" : undefined} onClick={() => setTab("dossiers")}>
          Dosare angajați
        </button>
        <button type="button" className={tab === "accidents" ? "active" : undefined} onClick={() => setTab("accidents")}>
          Accidente
        </button>
        <button type="button" className={tab === "reports" ? "active" : undefined} onClick={() => setTab("reports")}>
          Rapoarte
        </button>
        <button type="button" className={tab === "visits" ? "active" : undefined} onClick={() => setTab("visits")}>
          Evidență vizită
        </button>
        <button type="button" className={tab === "gdpr" ? "active" : undefined} onClick={() => setTab("gdpr")}>
          Jurnal GDPR
        </button>
      </nav>

      {downloadError ? <p className="form-error">{downloadError}</p> : null}

      {tab === "control" ? (
        <section className="card">
          <div className="ssm-card-header">
            <h2 className="card-title">Acces rapid control ITM/ISU</h2>
            {canExport ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => runDownload(ssmApi.getItmControlPackageUrl(worksiteId || undefined), "pachet-control-itm.zip")}
              >
                Export pachet control (ZIP)
              </button>
            ) : null}
          </div>
          {complianceQuery.data ? (
            <dl className="itm-kpi">
              <div>
                <dt>Conformitate globală</dt>
                <dd>{complianceQuery.data.kpi.globalScore}%</dd>
              </div>
              <div>
                <dt>Angajați la zi</dt>
                <dd>
                  {complianceQuery.data.kpi.compliantEmployees} / {complianceQuery.data.kpi.totalEmployees}
                </dd>
              </div>
              <div>
                <dt>Restanțe</dt>
                <dd>{complianceQuery.data.kpi.overdueEmployees}</dd>
              </div>
            </dl>
          ) : null}
          <div className="field">
            <label htmlFor="itm-doc-search">Caută în dosarul de control</label>
            <input
              id="itm-doc-search"
              value={docSearch}
              onChange={(event) => setDocSearch(event.target.value)}
              placeholder="Titlu, alocare sau fișier…"
            />
          </div>
          {controlQuery.isLoading ? <p>Se încarcă documentele…</p> : null}
          {controlQuery.isError ? (
            <p className="form-error">{controlQuery.error instanceof Error ? controlQuery.error.message : "Eroare"}</p>
          ) : null}
          {controlFolders.length === 0 && !controlQuery.isLoading ? (
            <p className="field-hint">Nu există documente active marcate pentru control pe filtrul curent.</p>
          ) : null}
          {controlFolders.map((folder) => (
            <div key={folder.key} className="itm-folder-block">
              <h3>
                {DOC_TYPE_LABELS[folder.key.split("/")[0] ?? ""] ?? folder.label} ({folder.documents.length})
              </h3>
              <ul className="data-list">
                {folder.documents.map((doc) => (
                  <li key={doc.id}>
                    <span>
                      {doc.title}
                      {doc.targetLabel ? <span className="field-hint"> — {doc.targetLabel}</span> : null}
                      {doc.activeVersion ? (
                        <span className="field-hint">
                          {" "}
                          · v{doc.activeVersion.versionNumber} · {doc.activeVersion.fileName}
                        </span>
                      ) : null}
                    </span>
                    <span className="itm-doc-actions">
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          setPreview({
                            id: doc.id,
                            title: doc.title,
                            mimeType: doc.activeVersion?.mimeType
                          })
                        }
                      >
                        Previzualizează
                      </button>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          runDownload(
                            ssmApi.getItmDocumentFileUrl(doc.id, "download"),
                            doc.activeVersion?.fileName ?? `${doc.title}.pdf`
                          )
                        }
                      >
                        Descarcă
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "dossiers" ? (
        <section className="card form-stack">
          <h2 className="card-title">Dosar digital angajat</h2>
          <p className="field-hint">
            Consultă fișele de instruire semnate, aptitudinea medicală și exportul ZIP pentru control ITM.
          </p>
          <div className="field">
            <label htmlFor="itm-employee-search">Caută angajat</label>
            <input
              id="itm-employee-search"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Nume sau e-mail…"
            />
          </div>
          {employeesQuery.isLoading ? <p className="field-hint">Se caută…</p> : null}
          <ul className="data-list">
            {(employeesQuery.data?.items ?? []).slice(0, 20).map((employee) => (
              <li key={employee.id}>
                <button
                  type="button"
                  className={`itm-employee-pick${selectedEmployeeId === employee.id ? " active" : ""}`}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  <strong>{employee.fullName}</strong>
                  <span className="field-hint">
                    {employee.jobPositionName ?? "Fără post"} · {employee.departmentName ?? "Fără departament"} ·{" "}
                    {employee.worksiteName ?? "Fără punct"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!employeesQuery.isLoading && !(employeesQuery.data?.items ?? []).length ? (
            <p className="field-hint">Niciun angajat pe filtrul curent.</p>
          ) : null}

          {dossierQuery.isLoading ? <p>Se încarcă dosarul…</p> : null}
          {dossierQuery.data ? (
            <div className="itm-dossier">
              <div className="ssm-card-header">
                <h3 className="card-title">{dossierQuery.data.employee?.fullName ?? "Dosar"}</h3>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    runDownload(
                      ssmApi.getItmEmployeeDossierZipUrl(selectedEmployeeId),
                      `dosar-${selectedEmployeeId}.zip`
                    )
                  }
                >
                  Export ZIP dosar
                </button>
              </div>
              {dossierQuery.data.employee?.medicalBlockedAdmission ? (
                <p className="feedback warn">Blocat la admiterea la lucru (aptitudine medicală).</p>
              ) : null}
              <h4>Instruiri</h4>
              <ul className="data-list">
                {dossierQuery.data.trainings.map((training) => (
                  <li key={training.id}>
                    <span>
                      {training.type} · {training.status}
                      {training.score != null ? ` · scor ${training.score}` : ""}
                    </span>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() =>
                        runDownload(ssmApi.getIndividualSheetUrl(training.id), "fisa-instruire-anexa-11.pdf")
                      }
                    >
                      Anexa 11
                    </button>
                  </li>
                ))}
              </ul>
              {!dossierQuery.data.trainings.length ? <p className="field-hint">Fără instruiri în dosar.</p> : null}
              <h4>Controale medicale</h4>
              <ul className="data-list">
                {(dossierQuery.data.medicalControls ?? []).map((control) => (
                  <li key={control.id}>
                    <span>
                      {control.controlType} · {control.result ?? "fără rezultat"}
                      {control.blockedAdmission ? " · blocare admitere" : ""}
                    </span>
                    {control.hasAptitudeSheet ? (
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          runDownload(ssmApi.getMedicalAptitudeSheetUrl(control.id), "fisa-aptitudini.pdf")
                        }
                      >
                        Fișă aptitudini
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "accidents" ? (
        <section className="card">
          <h2 className="card-title">Registru accidente (vizualizare)</h2>
          {accidentsQuery.isLoading ? <p>Se încarcă…</p> : null}
          <ul className="data-list">
            {filteredAccidents.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> — {item.type} / {item.status}
                {item.itmDaysOff != null ? ` · Zile ITM: ${item.itmDaysOff}` : ""}
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => runDownload(ssmApi.getAccidentReportUrl(item.id), "proces-verbal-cercetare-art128.pdf")}
                >
                  PV cercetare art. 128
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="card form-stack">
          <h2 className="card-title">Rapoarte conformitate</h2>
          <p className="field-hint">Export PDF/Excel pentru evidențe la control. Acțiunea este jurnalizată GDPR.</p>
          <FieldSelect
            id="itm-report-type"
            label="Tip raport"
            value={reportType}
            onChange={(value) => setReportType(value as SsmReportType)}
            options={ITM_REPORTS.map((item) => ({ value: item.type, label: item.label }))}
          />
          {reportQuery.isLoading ? <p className="field-hint">Se încarcă previzualizarea…</p> : null}
          {reportQuery.data ? (
            <p className="field-hint">{reportQuery.data.rows.length} rânduri în raportul curent.</p>
          ) : null}
          {canExport ? (
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  runDownload(ssmApi.getSsmReportPdfUrl(reportType, reportFilters), `raport-${reportType}.pdf`)
                }
              >
                PDF
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  runDownload(ssmApi.getSsmReportExcelUrl(reportType, reportFilters), `raport-${reportType}.xlsx`)
                }
              >
                Excel
              </button>
            </div>
          ) : (
            <p className="form-error">Contul nu are permisiune de export rapoarte.</p>
          )}
        </section>
      ) : null}

      {tab === "visits" ? (
        <section className="card form-stack">
          <h2 className="card-title">Evidență vizită control</h2>
          <p className="field-hint">Deschide o vizită pe punctul de lucru filtrat, apoi închide-o la finalul controlului.</p>
          <div className="field">
            <label htmlFor="itm-visit-notes">Note vizită</label>
            <textarea id="itm-visit-notes" rows={3} value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" disabled={startVisit.isPending} onClick={() => startVisit.mutate()}>
            {startVisit.isPending ? "Se deschide…" : "Deschide vizită"}
          </button>
          {startVisit.isError ? <p className="form-error">{mutationErrorMessage(startVisit.error)}</p> : null}
          <ul className="data-list">
            {(visitsQuery.data?.items ?? []).map((visit) => (
              <li key={visit.id}>
                <span>
                  <strong>{visit.worksiteName ?? "Toate punctele"}</strong> · {visit.inspectorName ?? visit.inspectorUserId} ·{" "}
                  {new Date(visit.startedAt).toLocaleString("ro-RO")}
                  {visit.endedAt ? ` → ${new Date(visit.endedAt).toLocaleString("ro-RO")}` : ""}
                </span>
                {visit.status === "OPEN" ? (
                  <button type="button" className="btn-text" onClick={() => closeVisit.mutate(visit.id)}>
                    Închide vizita
                  </button>
                ) : (
                  <span className="badge-good">Închisă</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "gdpr" ? (
        <section className="card">
          <h2 className="card-title">Jurnal acces (GDPR)</h2>
          <p className="field-hint">
            Cine a vizualizat, descărcat sau exportat ce documente din dosarul de control. Inspectorii văd propriul jurnal.
          </p>
          {logsQuery.isLoading ? <p>Se încarcă jurnalul…</p> : null}
          <ul className="itm-gdpr-log">
            {(logsQuery.data ?? []).map((row) => (
              <li key={row.id}>
                <strong>{row.userName || row.userEmail}</strong>
                <span>
                  {actionLabel(row.action)} · {row.resourceLabel ?? row.resourceType}
                  {row.resourceTitle ? ` · ${row.resourceTitle}` : ""}
                </span>
                <span>{new Date(row.createdAt).toLocaleString("ro-RO")}</span>
              </li>
            ))}
          </ul>
          {!logsQuery.isLoading && !(logsQuery.data ?? []).length ? (
            <p className="field-hint">Nicio înregistrare de acces.</p>
          ) : null}
        </section>
      ) : null}

      {preview ? (
        <DocumentPreviewModal
          documentId={preview.id}
          title={preview.title}
          mimeType={preview.mimeType}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
