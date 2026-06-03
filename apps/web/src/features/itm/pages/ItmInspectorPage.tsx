import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../../ssm/api/ssm.api";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";

type Tab = "control" | "accidents" | "reports";

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

export function ItmInspectorPage() {
  const session = useAuthSession();
  const roles = session?.roles ?? [];
  const [tab, setTab] = useState<Tab>("control");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const controlQuery = useQuery({
    queryKey: ["itm", "control"],
    queryFn: () => ssmApi.getControlFolders(),
    enabled: tab === "control"
  });

  const accidentsQuery = useQuery({
    queryKey: ["itm", "accidents"],
    queryFn: () => ssmApi.listAccidentCases({ page: 1, pageSize: 50 }),
    enabled: tab === "accidents" && hasPermission(roles, "ssm:accident:view")
  });

  const canExport = hasPermission(roles, "ssm:reports:export");

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Portal inspector ITM / ISU</h1>
        <p className="page-subtitle">
          Acces doar în citire la documentele marcate pentru control, accidente și rapoarte de conformitate.
        </p>
      </header>

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
      </nav>

      {downloadError ? <p className="form-error">{downloadError}</p> : null}

      {tab === "control" ? (
        <section className="card">
          <h2 className="card-title">Acces rapid control ITM/ISU</h2>
          {controlQuery.isLoading ? <p>Se încarcă documentele…</p> : null}
          {controlQuery.isError ? (
            <p className="form-error">{controlQuery.error instanceof Error ? controlQuery.error.message : "Eroare"}</p>
          ) : null}
          {(controlQuery.data?.folders ?? []).length === 0 && !controlQuery.isLoading ? (
            <p className="field-hint">Nu există documente active marcate pentru control.</p>
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
            {(accidentsQuery.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> — {item.type} / {item.status}
                {item.itmDaysOff != null ? ` · Zile ITM: ${item.itmDaysOff}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="card">
          <h2 className="card-title">Rapoarte conformitate</h2>
          <p className="field-hint">Export PDF/Excel pentru evidențe la control.</p>
          {canExport ? (
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadWithAuth("/ssm/reports/compliance.pdf", "raport-conformitate.pdf")}
              >
                Raport conformitate (PDF)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadWithAuth("/ssm/reports/compliance.xlsx", "raport-conformitate.xls")}
              >
                Raport conformitate (Excel)
              </button>
            </div>
          ) : (
            <p className="form-error">Contul nu are permisiune de export rapoarte.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
