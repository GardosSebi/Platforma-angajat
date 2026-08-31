import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../../ssm/api/ssm.api";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";

type Tab = "control" | "accidents" | "reports" | "visits" | "gdpr";

const DOC_TYPE_LABELS: Record<string, string> = {
  IPSSM: "IPSSM",
  RISK_ASSESSMENT: "Evaluare risc",
  PPP: "PPP",
  THEMATIC: "Tematic",
  DECISION: "Decizie",
  PSI: "PSI / SU",
  REGISTER: "Registru",
  OTHER: "Altele"
};

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

export function ItmInspectorPage() {
  const session = useAuthSession();
  const roles = session?.roles ?? [];
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("control");
  const [worksiteId, setWorksiteId] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const worksitesQuery = useQuery({
    queryKey: ["itm", "worksites"],
    queryFn: () => ssmApi.listItmWorksites()
  });

  const controlQuery = useQuery({
    queryKey: ["itm", "control", worksiteId || "all"],
    queryFn: () => ssmApi.getItmControl(worksiteId || undefined),
    enabled: tab === "control"
  });

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

  const startVisit = useMutation({
    mutationFn: () => ssmApi.startItmVisit({ worksiteId: worksiteId || undefined, notes: visitNotes || undefined }),
    onSuccess: async () => {
      setVisitNotes("");
      await queryClient.invalidateQueries({ queryKey: ["itm", "visits"] });
    }
  });

  const closeVisit = useMutation({
    mutationFn: (visitId: string) => ssmApi.closeItmVisit(visitId),
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

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Portal inspector ITM / ISU</h1>
        <p className="page-subtitle">
          Acces doar în citire, cu evidență GDPR: cine a văzut sau a descărcat ce documente.
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
                onClick={() => {
                  setDownloadError(null);
                  void downloadWithAuth(
                    ssmApi.getItmControlPackageUrl(worksiteId || undefined),
                    "pachet-control-itm.zip"
                  ).catch((e) => setDownloadError(e instanceof Error ? e.message : "Export eșuat."));
                }}
              >
                Export pachet control (ZIP)
              </button>
            ) : null}
          </div>
          {controlQuery.isLoading ? <p>Se încarcă documentele…</p> : null}
          {controlQuery.isError ? (
            <p className="form-error">{controlQuery.error instanceof Error ? controlQuery.error.message : "Eroare"}</p>
          ) : null}
          {(controlQuery.data?.folders ?? []).length === 0 && !controlQuery.isLoading ? (
            <p className="field-hint">Nu există documente active marcate pentru control pe filtrul curent.</p>
          ) : null}
          {(controlQuery.data?.folders ?? []).map((folder) => (
            <div key={folder.key} className="itm-folder-block">
              <h3>
                {DOC_TYPE_LABELS[folder.key.split("/")[0] ?? ""] ?? folder.label} ({folder.count})
              </h3>
              <ul className="data-list">
                {folder.documents.map((doc) => (
                  <li key={doc.id}>
                    <span>{doc.title}</span>
                    {doc.targetLabel ? <span className="field-hint"> — {doc.targetLabel}</span> : null}
                    <button
                      type="button"
                      className="btn-text"
                      onClick={async () => {
                        setDownloadError(null);
                        try {
                          await downloadWithAuth(`/ssm/documents/${doc.id}/file`, `${doc.title}.pdf`);
                        } catch (e) {
                          setDownloadError(e instanceof Error ? e.message : "Descărcare eșuată.");
                        }
                      }}
                    >
                      Descarcă
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
                  onClick={() => {
                    setDownloadError(null);
                    void downloadWithAuth(ssmApi.getAccidentReportUrl(item.id), `proces-verbal-cercetare-art128.pdf`).catch(
                      (e) => setDownloadError(e instanceof Error ? e.message : "Descărcare eșuată.")
                    );
                  }}
                >
                  PV cercetare art. 128
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="card">
          <h2 className="card-title">Rapoarte conformitate</h2>
          <p className="field-hint">Export PDF/Excel pentru evidențe la control. Acțiunea este jurnalizată GDPR.</p>
          {canExport ? (
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  downloadWithAuth(ssmApi.getSsmReportPdfUrl("compliance"), "raport-conformitate.pdf").catch((e) =>
                    setDownloadError(e instanceof Error ? e.message : "Descărcare eșuată.")
                  )
                }
              >
                Raport conformitate (PDF)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  downloadWithAuth(ssmApi.getSsmReportExcelUrl("compliance"), "raport-conformitate.xlsx").catch((e) =>
                    setDownloadError(e instanceof Error ? e.message : "Descărcare eșuată.")
                  )
                }
              >
                Raport conformitate (Excel)
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
            Cine a vizualizat, descărcat sau exportat documente din dosarul de control. Inspectorii văd propriul jurnal.
          </p>
          {logsQuery.isLoading ? <p>Se încarcă jurnalul…</p> : null}
          <ul className="itm-gdpr-log">
            {(logsQuery.data ?? []).map((row) => (
              <li key={row.id}>
                <strong>{row.userName || row.userEmail}</strong>
                <span>
                  {actionLabel(row.action)} · {row.resourceType}
                  {row.resourceId ? ` · ${row.resourceId}` : ""} · {new Date(row.createdAt).toLocaleString("ro-RO")}
                </span>
              </li>
            ))}
          </ul>
          {!logsQuery.isLoading && !(logsQuery.data ?? []).length ? (
            <p className="field-hint">Nicio înregistrare de acces.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
