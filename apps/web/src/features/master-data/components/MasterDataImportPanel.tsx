import { FormEvent, useRef, useState } from "react";
import { useImportEmployeesCsv } from "../hooks/useMasterData";
import { mutationErrorMessage } from "../master-data-shared";

const CSV_COLUMNS = [
  { name: "email", required: true, hint: "Email unic angajat" },
  { name: "fullName", required: true, hint: "Nume complet" },
  { name: "cnp", required: false, hint: "CNP (opțional)" },
  { name: "worksiteCode", required: false, hint: "Cod punct de lucru" },
  { name: "departmentCode", required: false, hint: "Cod departament" },
  { name: "jobCode", required: false, hint: "Cod post" },
  { name: "hireDate", required: false, hint: "YYYY-MM-DD" },
  { name: "leaveDate", required: false, hint: "YYYY-MM-DD" },
  { name: "active", required: false, hint: "true / false" }
] as const;

const CSV_TEMPLATE = `email,fullName,cnp,worksiteCode,departmentCode,jobCode,hireDate,leaveDate,active
ion.popescu@firma.local,Ion Popescu,,HQ,ADMIN,MGR,2024-01-15,,true`;

export function MasterDataImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [fileName, setFileName] = useState<string | null>(null);
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

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setFeedback(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "angajati-sablon.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetTemplate = () => {
    setCsv(CSV_TEMPLATE);
    setFileName(null);
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const errors = importCsv.data?.errors ?? [];

  return (
    <section className="card comms-panel">
      <div className="comms-toolbar">
        <div className="comms-toolbar-start">
          <h2 className="card-title">Import angajați CSV</h2>
          <p className="comms-toolbar-hint">
            Încarcă un fișier CSV sau lipește conținutul. Rândurile existente se actualizează după email.
          </p>
        </div>
        <button type="button" className="btn-secondary comms-toolbar-cta" onClick={downloadTemplate}>
          Descarcă șablon
        </button>
      </div>

      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}

      {importCsv.data && !importCsv.isPending ? (
        <div className="comms-kpi" aria-label="Rezultat import">
          <div>
            <span>Creați</span>
            <strong>{importCsv.data.created}</strong>
          </div>
          <div>
            <span>Actualizați</span>
            <strong>{importCsv.data.updated}</strong>
          </div>
          <div>
            <span>Erori</span>
            <strong>{importCsv.data.errors.length}</strong>
          </div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table comms-table">
          <thead>
            <tr>
              <th>Coloană</th>
              <th>Obligatoriu</th>
              <th>Detalii</th>
            </tr>
          </thead>
          <tbody>
            {CSV_COLUMNS.map((column) => (
              <tr key={column.name}>
                <td className="comms-title-cell">
                  <code>{column.name}</code>
                </td>
                <td>
                  <span className={`comms-status comms-status--${column.required ? "good" : "warn"}`}>
                    {column.required ? "Da" : "Nu"}
                  </span>
                </td>
                <td>{column.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="md-import-csv-file">Fișier CSV</label>
          <input
            id="md-import-csv-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
          />
          <p className="field-hint">
            {fileName ? `Fișier încărcat: ${fileName}` : "Opțional — poți încărca un fișier sau edita textul de mai jos."}
          </p>
        </div>

        <div className="field">
          <label htmlFor="md-import-csv-content">Conținut CSV</label>
          <textarea
            id="md-import-csv-content"
            className="md-import-csv-textarea"
            rows={12}
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setFileName(null);
            }}
            spellCheck={false}
            placeholder="email,fullName,..."
          />
        </div>

        <div className="comms-compose-actions">
          <button type="submit" className="btn-primary" disabled={importCsv.isPending || !csv.trim()}>
            {importCsv.isPending ? "Se importă…" : "Importă angajați"}
          </button>
          <button type="button" className="btn-secondary" onClick={resetTemplate}>
            Resetează șablon
          </button>
        </div>
      </form>

      {errors.length ? (
        <>
          <h3 className="card-title">Erori la import ({errors.length})</h3>
          <div className="table-wrap">
            <table className="data-table comms-table">
              <thead>
                <tr>
                  <th>Rând</th>
                  <th>Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 50).map((err) => (
                  <tr key={`${err.row}-${err.message}`}>
                    <td className="comms-title-cell">{err.row}</td>
                    <td>{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.length > 50 ? (
            <p className="field-hint">Se afișează primele 50 de erori din {errors.length}.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
