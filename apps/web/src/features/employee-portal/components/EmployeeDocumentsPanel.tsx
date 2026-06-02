import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { employeePortalApi } from "../api/employee-portal.api";
import { mutationErrorMessage } from "../utils";

export function EmployeeDocumentsPanel() {
  const [q, setQ] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["employee-portal", "documents", q],
    queryFn: () => employeePortalApi.listDocuments({ page: 1, pageSize: 50, q: q || undefined })
  });

  const items = query.data?.items ?? [];

  return (
    <div className="employee-portal-documents">
      <div className="field employee-portal-search">
        <label htmlFor="doc-search">Caută document</label>
        <input
          id="doc-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Titlu sau alocare"
        />
      </div>

      {query.isLoading ? <p className="field-hint">Se încarcă documentele…</p> : null}
      {query.isError ? <p className="feedback error">{mutationErrorMessage(query.error)}</p> : null}

      {!query.isLoading && !items.length ? (
        <div className="employee-portal-empty card">
          <p>Nu există documente aplicabile profilului tău.</p>
        </div>
      ) : null}

      <ul className="employee-doc-list">
        {items.map((doc) => (
          <li key={doc.id} className="card employee-doc-item">
            <div>
              <strong>{doc.title}</strong>
              <p className="field-hint">
                {doc.type} · {doc.targetLabel ?? doc.targetType} · v{doc.activeVersion.versionNumber}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDownloadError(null);
                void downloadWithAuth(
                  employeePortalApi.getDocumentFileUrl(doc.id),
                  doc.activeVersion.fileName
                ).catch((err: unknown) => setDownloadError(mutationErrorMessage(err)));
              }}
            >
              Deschide / descarcă
            </button>
          </li>
        ))}
      </ul>
      {downloadError ? <p className="feedback error">{downloadError}</p> : null}
    </div>
  );
}
