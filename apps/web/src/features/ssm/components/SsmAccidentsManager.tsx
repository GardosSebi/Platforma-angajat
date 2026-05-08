import { FormEvent, useMemo, useState } from "react";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentTaskRequest,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@repo/shared-types/ssm";
import { getApiBaseUrl } from "../../../shared/api/api-base";
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

export function SsmAccidentsManager() {
  const casesQuery = useAccidentCases();
  const statsQuery = useAccidentStats();
  const createCase = useCreateAccidentCase();
  const addTask = useAddAccidentTask();
  const completeTask = useCompleteAccidentTask();
  const closeCase = useCloseAccidentCase();

  const [caseForm, setCaseForm] = useState<CreateSsmAccidentCaseRequest>(EMPTY_CASE);
  const [taskForm, setTaskForm] = useState<CreateSsmAccidentTaskRequest>(EMPTY_TASK);
  const [closeForm, setCloseForm] = useState<CloseSsmAccidentCaseRequest>(EMPTY_CLOSE);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  const selectedCase = useMemo(
    () => casesQuery.data?.items.find((item) => item.id === selectedCaseId),
    [casesQuery.data?.items, selectedCaseId]
  );

  const onCreateCase = (event: FormEvent) => {
    event.preventDefault();
    createCase.mutate(caseForm, {
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

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreateCase}>
          <h3 className="card-title">Înregistrare caz</h3>
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
                  {type}
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
                  {severity}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="acc-title">Titlu</label>
            <input id="acc-title" value={caseForm.title} onChange={(e) => setCaseForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="acc-occ">Data eveniment (ISO)</label>
            <input
              id="acc-occ"
              value={caseForm.occurredAt}
              onChange={(e) => setCaseForm((p) => ({ ...p, occurredAt: e.target.value }))}
            />
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
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onAddTask}>
          <h3 className="card-title">Flux cercetare (task-uri)</h3>
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
              {(casesQuery.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.status})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-title">Task</label>
            <input id="task-title" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="task-due">Termen (ISO)</label>
            <input id="task-due" value={taskForm.dueAt} onChange={(e) => setTaskForm((p) => ({ ...p, dueAt: e.target.value }))} />
          </div>
          <button className="btn-primary" type="submit" disabled={addTask.isPending || !taskForm.accidentCaseId}>
            {addTask.isPending ? "Se adaugă..." : "Adaugă task"}
          </button>
          {selectedCase ? (
            <div className="ssm-history-list">
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
          <h3 className="card-title">Concluzii + măsuri + export raport</h3>
          <div className="field">
            <label htmlFor="close-case">Caz</label>
            <select id="close-case" value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
              <option value="">Selectează caz</option>
              {(casesQuery.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.status})
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
              <a
                className="btn-text-link"
                href={`${getApiBaseUrl()}${ssmApi.getAccidentReportUrl(selectedCaseId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Export PDF raport
              </a>
            ) : null}
          </div>
        </form>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Statistici accidentalitate</h3>
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
          <p className="field-hint">
            Tipuri: ACCIDENT {statsQuery.data?.byType.ACCIDENT ?? 0}, INCIDENT {statsQuery.data?.byType.INCIDENT ?? 0}, BOALĂ PROF.{" "}
            {statsQuery.data?.byType.OCCUPATIONAL_DISEASE ?? 0}
          </p>
          <p className="field-hint">
            Severitate: LOW {statsQuery.data?.bySeverity.LOW ?? 0}, MEDIUM {statsQuery.data?.bySeverity.MEDIUM ?? 0}, HIGH{" "}
            {statsQuery.data?.bySeverity.HIGH ?? 0}, CRITICAL {statsQuery.data?.bySeverity.CRITICAL ?? 0}
          </p>
        </div>
      </div>
    </section>
  );
}
