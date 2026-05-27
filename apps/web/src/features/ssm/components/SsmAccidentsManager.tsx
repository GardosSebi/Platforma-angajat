import { FormEvent, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentTaskRequest,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../api/ssm.api";
import {
  useAccidentCases,
  useAccidentStats,
  useAddAccidentTask,
  useCloseAccidentCase,
  useCompleteAccidentTask,
  useCreateAccidentCase
} from "../hooks/useSsmAccidents";

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

const ACCIDENT_TYPES: SsmAccidentType[] = ["ACCIDENT", "INCIDENT", "OCCUPATIONAL_DISEASE"];
const ACCIDENT_SEVERITIES: SsmAccidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const EMPTY_CASE: CreateSsmAccidentCaseRequest = {
  employeeId: DEMO_EMPLOYEE_ID,
  type: "INCIDENT",
  severity: "LOW",
  title: "Incident near-miss",
  occurredAt: new Date().toISOString(),
  location: "Punct lucru HQ",
  description: "Descriere incident și context.",
  witnesses: [],
  itmDaysOff: undefined,
  hasPermanentDisability: false,
  isFatality: false,
  legalDaysDeadline: 30
};

const EMPTY_TASK: CreateSsmAccidentTaskRequest = {
  accidentCaseId: "",
  title: "Colectare declarații și dovezi",
  assignedTo: "Responsabil SSM",
  dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  notes: "Task cercetare inițială"
};

const EMPTY_CLOSE: CloseSsmAccidentCaseRequest = {
  conclusions: "Concluzii cercetare.",
  correctiveMeasures: "Măsuri corective asumate cu termene."
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function typeLabel(type: SsmAccidentType): string {
  switch (type) {
    case "ACCIDENT":
      return "Accident de muncă";
    case "INCIDENT":
      return "Incident periculos (near-miss)";
    case "OCCUPATIONAL_DISEASE":
      return "Boală profesională";
    default:
      return type;
  }
}

function severityLabel(severity: SsmAccidentSeverity): string {
  switch (severity) {
    case "LOW":
      return "Scăzută";
    case "MEDIUM":
      return "Medie";
    case "HIGH":
      return "Ridicată";
    case "CRITICAL":
      return "Critică";
    default:
      return severity;
  }
}

export function SsmAccidentsManager() {
  const casesPage = usePagination();
  const casesQuery = useAccidentCases(casesPage.params);
  const casesPaged = paginationFromResult(casesQuery.data, casesPage.page, casesPage.pageSize);
  const statsQuery = useAccidentStats();
  const createCase = useCreateAccidentCase();
  const addTask = useAddAccidentTask();
  const completeTask = useCompleteAccidentTask();
  const closeCase = useCloseAccidentCase();

  const [caseForm, setCaseForm] = useState<CreateSsmAccidentCaseRequest>(EMPTY_CASE);
  const [taskForm, setTaskForm] = useState<CreateSsmAccidentTaskRequest>(EMPTY_TASK);
  const [closeForm, setCloseForm] = useState<CloseSsmAccidentCaseRequest>(EMPTY_CLOSE);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [witnessesText, setWitnessesText] = useState("");

  const selectedCase = useMemo(
    () => casesPaged.items.find((item) => item.id === selectedCaseId),
    [casesPaged.items, selectedCaseId]
  );
  const occurredLocal = useMemo(() => toDatetimeLocalValue(caseForm.occurredAt), [caseForm.occurredAt]);
  const taskDueLocal = useMemo(() => toDatetimeLocalValue(taskForm.dueAt), [taskForm.dueAt]);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const onCreateCase = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateSsmAccidentCaseRequest = {
      ...caseForm,
      witnesses: witnessesText
        .split(/[,;\n]/)
        .map((w) => w.trim())
        .filter(Boolean)
    };
    createCase.mutate(payload, {
      onSuccess: (created) => {
        setSelectedCaseId(created.id);
        setTaskForm((prev) => ({ ...prev, accidentCaseId: created.id }));
      }
    });
  };

  const onAddTask = (event: FormEvent) => {
    event.preventDefault();
    addTask.mutate(taskForm);
  };

  const onCloseCase = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    closeCase.mutate({
      caseId: selectedCaseId,
      payload: closeForm
    });
  };

  return (
    <section className="ssm-documents" aria-labelledby="accidents-title">
      <h2 id="accidents-title" className="card-title">
        Accidente / incidente / boli profesionale (3.6)
      </h2>
      <p className="field-hint">
        Flux recomandat: 1) înregistrezi cazul, 2) gestionezi task-urile de cercetare, 3) închizi cazul și exporți raportul.
      </p>

      <div className="ssm-history-list">
        <div className="ssm-history-item">
          <strong>Total cazuri</strong>
          <span>{statsQuery.data?.totalCases ?? 0}</span>
        </div>
        <div className="ssm-history-item">
          <strong>Cazuri deschise</strong>
          <span>{statsQuery.data?.openCases ?? 0}</span>
        </div>
        <div className="ssm-history-item">
          <strong>Task-uri restante</strong>
          <span className={(statsQuery.data?.overdueTasks ?? 0) > 0 ? "badge-bad" : "badge-good"}>
            {statsQuery.data?.overdueTasks ?? 0}
          </span>
        </div>
      </div>

      <PaginationBar
        page={casesPaged.page}
        pageSize={casesPaged.pageSize}
        total={casesPaged.total}
        totalPages={casesPaged.totalPages}
        onPageChange={casesPage.setPage}
        onPageSizeChange={casesPage.setPageSize}
        disabled={casesQuery.isFetching}
      />

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreateCase}>
          <h3 className="card-title">Pasul 1: Înregistrare caz</h3>
          <div className="field">
            <label htmlFor="acc-emp">Employee ID</label>
            <input
              id="acc-emp"
              value={caseForm.employeeId ?? ""}
              onChange={(e) => setCaseForm((p) => ({ ...p, employeeId: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="acc-type">Tip</label>
            <select
              id="acc-type"
              value={caseForm.type}
              onChange={(e) => setCaseForm((p) => ({ ...p, type: e.target.value as SsmAccidentType }))}
            >
              {ACCIDENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="acc-severity">Severitate</label>
            <select
              id="acc-severity"
              value={caseForm.severity}
              onChange={(e) => setCaseForm((p) => ({ ...p, severity: e.target.value as SsmAccidentSeverity }))}
            >
              {ACCIDENT_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severityLabel(severity)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="acc-title">Titlu</label>
            <input id="acc-title" value={caseForm.title} onChange={(e) => setCaseForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="acc-occ">Data și ora evenimentului</label>
            <input
              id="acc-occ"
              type="datetime-local"
              value={occurredLocal}
              onChange={(e) =>
                setCaseForm((p) => ({
                  ...p,
                  occurredAt: e.target.value ? fromDatetimeLocalValue(e.target.value) : p.occurredAt
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="acc-witnesses">Martori (separați prin virgulă)</label>
            <input
              id="acc-witnesses"
              value={witnessesText}
              onChange={(e) => setWitnessesText(e.target.value)}
              placeholder="Ion Popescu, Maria Ionescu"
            />
          </div>
          <div className="field">
            <label htmlFor="acc-itm-days">Zile ITM (concediu medical)</label>
            <input
              id="acc-itm-days"
              type="number"
              min={0}
              value={caseForm.itmDaysOff ?? ""}
              onChange={(e) =>
                setCaseForm((p) => ({
                  ...p,
                  itmDaysOff: e.target.value === "" ? undefined : Number(e.target.value)
                }))
              }
            />
          </div>
          <div className="ssm-form-grid">
            <div className="field inline-check">
              <input
                id="acc-disability"
                type="checkbox"
                checked={caseForm.hasPermanentDisability ?? false}
                onChange={(e) => setCaseForm((p) => ({ ...p, hasPermanentDisability: e.target.checked }))}
              />
              <label htmlFor="acc-disability">Invaliditate permanentă</label>
            </div>
            <div className="field inline-check">
              <input
                id="acc-fatality"
                type="checkbox"
                checked={caseForm.isFatality ?? false}
                onChange={(e) => setCaseForm((p) => ({ ...p, isFatality: e.target.checked }))}
              />
              <label htmlFor="acc-fatality">Deces</label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="acc-desc">Descriere</label>
            <input
              id="acc-desc"
              value={caseForm.description}
              onChange={(e) => setCaseForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={createCase.isPending}>
            {createCase.isPending ? "Se salvează..." : "Creează caz"}
          </button>
          {createCase.isSuccess ? (
            <p className="feedback success" role="status">
              Cazul a fost creat.
            </p>
          ) : null}
          {createCase.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(createCase.error)}
            </p>
          ) : null}
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onAddTask}>
          <h3 className="card-title">Pasul 2: Flux cercetare (task-uri)</h3>
          <div className="field">
            <label htmlFor="task-case">Caz</label>
            <select
              id="task-case"
              value={taskForm.accidentCaseId}
              onChange={(e) => {
                setTaskForm((p) => ({ ...p, accidentCaseId: e.target.value }));
                setSelectedCaseId(e.target.value);
              }}
            >
              <option value="">Selectează caz</option>
              {(casesPaged.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({typeLabel(item.type)} - {item.status})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-title">Task</label>
            <input id="task-title" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="task-due">Termen task</label>
            <input
              id="task-due"
              type="datetime-local"
              value={taskDueLocal}
              onChange={(e) =>
                setTaskForm((p) => ({
                  ...p,
                  dueAt: e.target.value ? fromDatetimeLocalValue(e.target.value) : p.dueAt
                }))
              }
            />
          </div>
          <button className="btn-primary" type="submit" disabled={addTask.isPending || !taskForm.accidentCaseId}>
            {addTask.isPending ? "Se adaugă..." : "Adaugă task"}
          </button>
          {addTask.isSuccess ? (
            <p className="feedback success" role="status">
              Task-ul a fost adăugat.
            </p>
          ) : null}
          {addTask.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(addTask.error)}
            </p>
          ) : null}
          {completeTask.isSuccess ? (
            <p className="feedback success" role="status">
              Task-ul a fost marcat ca finalizat.
            </p>
          ) : null}
          {completeTask.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(completeTask.error)}
            </p>
          ) : null}
          {selectedCase ? (
            <div className="ssm-history-list">
              <div className="ssm-history-item">
                <div>
                  <strong>{selectedCase.title}</strong>
                  <div className="field-hint">
                    {typeLabel(selectedCase.type)} | severitate {severityLabel(selectedCase.severity)} | status {selectedCase.status}
                  </div>
                </div>
                <span className={selectedCase.status === "CLOSED" ? "badge-good" : "badge-bad"}>
                  {selectedCase.status}
                </span>
              </div>
              {selectedCase.tasks.map((task) => (
                <div key={task.id} className="ssm-history-item">
                  <div>
                    <strong>{task.title}</strong>
                    <div className="field-hint">
                      due {task.dueAt} | {task.completedAt ? "COMPLETED" : "OPEN"}
                    </div>
                  </div>
                  {!task.completedAt ? (
                    <button type="button" className="btn-text" onClick={() => completeTask.mutate(task.id)}>
                      Completează
                    </button>
                  ) : (
                    <span className="badge-good">Done</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </form>
      </div>

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onCloseCase}>
          <h3 className="card-title">Pasul 3: Concluzii + măsuri + export raport</h3>
          <div className="field">
            <label htmlFor="close-case">Caz</label>
            <select id="close-case" value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
              <option value="">Selectează caz</option>
              {(casesPaged.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({typeLabel(item.type)} - {item.status})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="close-conc">Concluzii</label>
            <input
              id="close-conc"
              value={closeForm.conclusions}
              onChange={(e) => setCloseForm((p) => ({ ...p, conclusions: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="close-measures">Măsuri corective</label>
            <input
              id="close-measures"
              value={closeForm.correctiveMeasures}
              onChange={(e) => setCloseForm((p) => ({ ...p, correctiveMeasures: e.target.value }))}
            />
          </div>
          <div className="ssm-inline-actions">
            <button type="submit" className="btn-primary" disabled={closeCase.isPending || !selectedCaseId}>
              {closeCase.isPending ? "Se închide..." : "Închide caz"}
            </button>
            {selectedCaseId ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const caseId = selectedCaseId;
                  if (!caseId) return;
                  setDownloadError(null);
                  void downloadWithAuth(ssmApi.getAccidentReportUrl(caseId), `accident-report-${caseId}.pdf`).catch(
                    (error: unknown) => {
                      setDownloadError(mutationErrorMessage(error));
                    }
                  );
                }}
              >
                Export PDF raport
              </button>
            ) : null}
          </div>
          {closeCase.isSuccess ? (
            <p className="feedback success" role="status">
              Cazul a fost închis.
            </p>
          ) : null}
          {closeCase.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(closeCase.error)}
            </p>
          ) : null}
          {downloadError ? <p className="feedback error">{downloadError}</p> : null}
        </form>

      </div>
    </section>
  );
}
