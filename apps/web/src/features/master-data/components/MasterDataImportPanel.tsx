import { FormEvent, useState } from "react";
import { useImportEmployeesCsv } from "../hooks/useMasterData";
import { mutationErrorMessage } from "../master-data-shared";

const CSV_TEMPLATE = `email,fullName,cnp,worksiteCode,departmentCode,jobCode,hireDate,leaveDate,active
ion.popescu@firma.local,Ion Popescu,,HQ,ADMIN,MGR,2024-01-15,,true`;

export function MasterDataImportPanel() {
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const importCsv = useImportEmployeesCsv();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    importCsv.mutate(csv, {
      onSuccess: (result) => {
        const errorNote = result.errors.length ? ` Erori: ${result.errors.length}.` : "";
        setFeedback({
          type: result.errors.length ? "error" : "success",
          message: `Import finalizat: ${result.created} creați, ${result.updated} actualizați.${errorNote}`
        });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  return (
    <section className="card comms-panel">
      <h2 className="card-title">Import angajați din CSV</h2>
      <p className="field-hint">
        Coloane suportate: <code>email</code>, <code>fullName</code> (obligatorii), plus opțional{" "}
        <code>cnp</code>, <code>worksiteCode</code>, <code>departmentCode</code>, <code>jobCode</code>,{" "}
        <code>hireDate</code>, <code>leaveDate</code>, <code>active</code>.
      </p>

      {feedback ? (
        <p className={`feedback ${feedback.type}`} role="status">
          {feedback.message}
        </p>
      ) : null}

      {importCsv.data?.errors.length ? (
        <ul className="data-list">
          {importCsv.data.errors.slice(0, 10).map((err) => (
            <li key={`${err.row}-${err.message}`}>
              Rând {err.row}: {err.message}
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onSubmit}>
        <label>
          Conținut CSV
          <textarea
            className="master-data-csv-input"
            rows={12}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="ssm-inline-actions">
          <button type="button" className="btn-secondary" onClick={() => setCsv(CSV_TEMPLATE)}>
            Resetează șablon
          </button>
          <button type="submit" className="btn-primary" disabled={importCsv.isPending}>
            {importCsv.isPending ? "Se importă…" : "Importă angajați"}
          </button>
        </div>
      </form>
    </section>
  );
}
