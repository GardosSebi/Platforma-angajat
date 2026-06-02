import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { ssmApi } from "../../ssm/api/ssm.api";
import { formatRoDate, mutationErrorMessage } from "../utils";

export function EmployeeDossierPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["employee-portal", "dossier", employeeId],
    queryFn: () => ssmApi.employeeDigitalFile(employeeId!),
    enabled: Boolean(employeeId)
  });

  if (!employeeId) {
    return (
      <div className="employee-portal-empty card">
        <p>Contul tău nu este legat de un profil de angajat.</p>
        <p className="field-hint">Contactează HR sau administratorul pentru asocierea e-mailului cu fișa de personal.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return <p className="field-hint">Se încarcă dosarul digital…</p>;
  }

  if (query.isError) {
    return <p className="feedback error">{mutationErrorMessage(query.error)}</p>;
  }

  const data = query.data;

  return (
    <div className="employee-portal-dossier">
      <div className="ssm-inline-actions employee-dossier-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setDownloadError(null);
            void downloadWithAuth(ssmApi.getDigitalFileZipUrl(employeeId), `dosar-${employeeId}.zip`).catch(
              (err: unknown) => setDownloadError(mutationErrorMessage(err))
            );
          }}
        >
          Export ZIP dosar complet
        </button>
      </div>
      {downloadError ? <p className="feedback error">{downloadError}</p> : null}

      <section className="card employee-dossier-section">
        <h3 className="card-title">Istoric instruiri</h3>
        {!data?.trainings.length ? (
          <p className="field-hint">Nicio instruire înregistrată.</p>
        ) : (
          <ul className="employee-dossier-list">
            {data.trainings.map((t) => (
              <li key={t.id}>
                <strong>{t.type}</strong>
                <span>
                  {t.status}
                  {t.score != null ? ` · scor ${t.score}%` : ""}
                  {t.dueAt ? ` · scadență ${formatRoDate(t.dueAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card employee-dossier-section">
        <h3 className="card-title">Documente asociate</h3>
        {!data?.documents.length ? (
          <p className="field-hint">Niciun document în dosar.</p>
        ) : (
          <ul className="employee-dossier-list">
            {data.documents.map((d) => (
              <li key={d.id}>
                <strong>{d.title}</strong>
                <span>{d.type}{d.fileName ? ` · ${d.fileName}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data?.medicalControls?.length ? (
        <section className="card employee-dossier-section">
          <h3 className="card-title">Medicina muncii</h3>
          <ul className="employee-dossier-list">
            {data.medicalControls.map((c) => (
              <li key={c.id}>
                <strong>{c.controlType}</strong>
                <span>
                  {c.result ?? "—"}
                  {c.nextDueAt ? ` · următor control ${formatRoDate(c.nextDueAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
