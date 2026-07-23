import { FormEvent, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentCorrectiveMeasureRequest,
  CreateSsmAccidentTaskRequest,
  SsmAccidentCaseItem,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useDepartmentsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { ssmApi } from "../api/ssm.api";
import {
  useAccidentCases,
  useAccidentStats,
  useAddAccidentCorrectiveMeasure,
  useAddAccidentTask,
  useCloseAccidentCase,
  useCompleteAccidentCorrectiveMeasure,
  useCompleteAccidentTask,
  useCreateAccidentCase
} from "../hooks/useSsmAccidents";

type AccidentsTab = "register" | "research" | "measures" | "stats";

const ACCIDENT_TABS: Array<{ id: AccidentsTab; title: string; caption: string }> = [
  { id: "register", title: "Registru", caption: "Listă și înregistrare caz" },
  { id: "research", title: "Cercetare", caption: "Task-uri și responsabili" },
  { id: "measures", title: "Măsuri & închidere", caption: "Corecții, concluzii, PDF" },
  { id: "stats", title: "Statistici", caption: "Frecvență și distribuții" }
];

const EMPTY_CASE: CreateSsmAccidentCaseRequest = {
  employeeId: "",
  worksiteId: "",
  departmentId: "",
  type: "INCIDENT",
  severity: "LOW",
  title: "",
  occurredAt: new Date().toISOString(),
  location: "",
  description: "",
  witnesses: [],
  contributingFactors: "",
  immediateMeasures: "",
  itmDaysOff: undefined,
  hasPermanentDisability: false,
  isFatality: false,
  diseaseConfirmed: false,
  diseaseConfirmedAt: undefined,
  diseaseConfirmedBy: "",
  diseaseDocumentRef: "",
  researchResponsible: "",
  legalDaysDeadline: 30
};

const ACCIDENT_TYPES: SsmAccidentType[] = ["ACCIDENT", "INCIDENT", "OCCUPATIONAL_DISEASE"];
const ACCIDENT_SEVERITIES: SsmAccidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const EMPTY_TASK: CreateSsmAccidentTaskRequest = {
  accidentCaseId: "",
  title: "Colectare declarații și dovezi",
  assignedTo: "",
  dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  notes: ""
};

const EMPTY_MEASURE: CreateSsmAccidentCorrectiveMeasureRequest = {
  accidentCaseId: "",
  description: "",
  assignedTo: "",
  dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
};

const EMPTY_CLOSE: CloseSsmAccidentCaseRequest = {
  conclusions: "",
  correctiveMeasures: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function statusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return "Deschis";
    case "IN_RESEARCH":
      return "În cercetare";
    case "MEASURES_DEFINED":
      return "Măsuri definite";
    case "CLOSED":
      return "Închis";
    default:
      return status;
  }
}

function CaseContextBanner({
  selectedCase,
  onClear
}: {
  selectedCase: SsmAccidentCaseItem | undefined;
  onClear: () => void;
}) {
  if (!selectedCase) {
    return (
      <p className="field-hint" role="status">
        Selectează un caz din Registru pentru a lucra pe cercetare sau măsuri.
      </p>
    );
  }

  return (
    <div className="ssm-history-item" style={{ marginBottom: "1rem" }}>
      <div>
        <strong>{selectedCase.title}</strong>
        <div className="field-hint">
          {typeLabel(selectedCase.type)} · {severityLabel(selectedCase.severity)} · {statusLabel(selectedCase.status)}
          {selectedCase.employeeName ? ` · ${selectedCase.employeeName}` : ""}
          {selectedCase.location ? ` · ${selectedCase.location}` : ""}
        </div>
      </div>
      <div className="ssm-inline-actions">
        <span className={selectedCase.status === "CLOSED" ? "badge-good" : "badge-bad"}>
          {statusLabel(selectedCase.status)}
        </span>
        <button type="button" className="btn-text" onClick={onClear}>
          Schimbă cazul
        </button>
      </div>
    </div>
  );
}

export function SsmAccidentsManager() {
  const [tab, setTab] = useState<AccidentsTab>("register");
  const activeTabMeta = ACCIDENT_TABS.find((item) => item.id === tab) ?? ACCIDENT_TABS[0];

  const casesPage = usePagination();
  const casesQuery = useAccidentCases(casesPage.params);
  const casesPaged = paginationFromResult(casesQuery.data, casesPage.page, casesPage.pageSize);
  const worksites = useWorksitesLookup();
  const departments = useDepartmentsLookup();

  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const statsQuery = useAccidentStats({
    from: statsFrom ? new Date(`${statsFrom}T00:00:00`).toISOString() : undefined,
    to: statsTo ? new Date(`${statsTo}T23:59:59`).toISOString() : undefined
  });

  const createCase = useCreateAccidentCase();
  const addTask = useAddAccidentTask();
  const completeTask = useCompleteAccidentTask();
  const addMeasure = useAddAccidentCorrectiveMeasure();
  const completeMeasure = useCompleteAccidentCorrectiveMeasure();
  const closeCase = useCloseAccidentCase();

  const [caseForm, setCaseForm] = useState<CreateSsmAccidentCaseRequest>(EMPTY_CASE);
  const [taskForm, setTaskForm] = useState<CreateSsmAccidentTaskRequest>(EMPTY_TASK);
  const [measureForm, setMeasureForm] = useState<CreateSsmAccidentCorrectiveMeasureRequest>(EMPTY_MEASURE);
  const [closeForm, setCloseForm] = useState<CloseSsmAccidentCaseRequest>(EMPTY_CLOSE);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [witnessesText, setWitnessesText] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const selectedCase = useMemo(
    () => casesPaged.items.find((item) => item.id === selectedCaseId),
    [casesPaged.items, selectedCaseId]
  );
  const occurredLocal = useMemo(() => toDatetimeLocalValue(caseForm.occurredAt), [caseForm.occurredAt]);
  const diseaseConfirmedLocal = useMemo(
    () => toDatetimeLocalValue(caseForm.diseaseConfirmedAt),
    [caseForm.diseaseConfirmedAt]
  );
  const taskDueLocal = useMemo(() => toDatetimeLocalValue(taskForm.dueAt), [taskForm.dueAt]);
  const measureDueLocal = useMemo(() => toDatetimeLocalValue(measureForm.dueAt), [measureForm.dueAt]);

  const selectCase = (caseId: string, nextTab?: AccidentsTab) => {
    setSelectedCaseId(caseId);
    setTaskForm((prev) => ({ ...prev, accidentCaseId: caseId }));
    setMeasureForm((prev) => ({ ...prev, accidentCaseId: caseId }));
    if (nextTab) setTab(nextTab);
  };

  const clearSelectedCase = () => {
    setSelectedCaseId("");
    setTaskForm((prev) => ({ ...prev, accidentCaseId: "" }));
    setMeasureForm((prev) => ({ ...prev, accidentCaseId: "" }));
    setTab("register");
  };

  const onCreateCase = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateSsmAccidentCaseRequest = {
      ...caseForm,
      employeeId: caseForm.employeeId || undefined,
      worksiteId: caseForm.worksiteId || undefined,
      departmentId: caseForm.departmentId || undefined,
      location: caseForm.location?.trim() || undefined,
      contributingFactors: caseForm.type === "INCIDENT" ? caseForm.contributingFactors?.trim() || undefined : undefined,
      immediateMeasures: caseForm.type === "INCIDENT" ? caseForm.immediateMeasures?.trim() || undefined : undefined,
      diseaseConfirmed: caseForm.type === "OCCUPATIONAL_DISEASE" ? caseForm.diseaseConfirmed : false,
      diseaseConfirmedAt:
        caseForm.type === "OCCUPATIONAL_DISEASE" && caseForm.diseaseConfirmed
          ? caseForm.diseaseConfirmedAt
          : undefined,
      diseaseConfirmedBy:
        caseForm.type === "OCCUPATIONAL_DISEASE" ? caseForm.diseaseConfirmedBy?.trim() || undefined : undefined,
      diseaseDocumentRef:
        caseForm.type === "OCCUPATIONAL_DISEASE" ? caseForm.diseaseDocumentRef?.trim() || undefined : undefined,
      researchResponsible: caseForm.researchResponsible?.trim() || undefined,
      witnesses: witnessesText
        .split(/[,;\n]/)
        .map((w) => w.trim())
        .filter(Boolean)
    };
    createCase.mutate(payload, {
      onSuccess: (created) => {
        selectCase(created.id, "research");
        setCaseForm(EMPTY_CASE);
        setWitnessesText("");
        setShowCreateForm(false);
      }
    });
  };

  const onAddTask = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    addTask.mutate({
      ...taskForm,
      accidentCaseId: selectedCaseId,
      assignedTo: taskForm.assignedTo?.trim() || undefined,
      notes: taskForm.notes?.trim() || undefined
    });
  };

  const onAddMeasure = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    addMeasure.mutate({
      ...measureForm,
      accidentCaseId: selectedCaseId,
      assignedTo: measureForm.assignedTo?.trim() || undefined
    });
  };

  const onCloseCase = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    closeCase.mutate({
      caseId: selectedCaseId,
      payload: {
        conclusions: closeForm.conclusions,
        correctiveMeasures: closeForm.correctiveMeasures?.trim() || undefined
      }
    });
  };

  const stats = statsQuery.data;

  return (
    <section className="ssm-eip-panel" aria-label="Modul accidente">
      <div className="ssm-panel-tabs" role="tablist" aria-label="Secțiuni accidente">
        {ACCIDENT_TABS.map((item) => (
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

      <header className="ssm-panel-header">
        <h3 className="card-title">{activeTabMeta.title}</h3>
        <p className="field-hint">{activeTabMeta.caption}</p>
      </header>

      {tab === "register" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Cazuri înregistrate
              </h4>
              <button type="button" className="btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
                {showCreateForm ? "Ascunde formular" : "Caz nou"}
              </button>
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

            {casesQuery.isLoading ? <p>Se încarcă…</p> : null}
            <div className="ssm-history-list">
              {casesPaged.items.map((item) => (
                <div key={item.id} className="ssm-history-item">
                  <div>
                    <strong>{item.title}</strong>
                    <div className="field-hint">
                      {typeLabel(item.type)} · {statusLabel(item.status)} · {toDateInputValue(item.occurredAt)}
                      {item.employeeName ? ` · ${item.employeeName}` : ""}
                    </div>
                  </div>
                  <div className="ssm-inline-actions">
                    <span className={item.status === "CLOSED" ? "badge-good" : "badge-bad"}>
                      {statusLabel(item.status)}
                    </span>
                    <button type="button" className="btn-text" onClick={() => selectCase(item.id, "research")}>
                      Cercetare
                    </button>
                    <button type="button" className="btn-text" onClick={() => selectCase(item.id, "measures")}>
                      Măsuri
                    </button>
                  </div>
                </div>
              ))}
              {!casesPaged.items.length && !casesQuery.isLoading ? (
                <p className="field-hint">Nu există cazuri încă. Adaugă primul caz.</p>
              ) : null}
            </div>
          </div>

          {showCreateForm ? (
            <form className="card form-stack ssm-doc-card" onSubmit={onCreateCase}>
              <h4 className="card-title">Înregistrare caz nou</h4>
              <FieldSelect
                id="acc-type"
                label="Tip"
                value={caseForm.type}
                onChange={(type) => setCaseForm((p) => ({ ...p, type: type as SsmAccidentType }))}
                options={ACCIDENT_TYPES.map((type) => ({ value: type, label: typeLabel(type) }))}
              />
              <FieldSelect
                id="acc-severity"
                label="Severitate"
                value={caseForm.severity}
                onChange={(severity) => setCaseForm((p) => ({ ...p, severity: severity as SsmAccidentSeverity }))}
                options={ACCIDENT_SEVERITIES.map((severity) => ({ value: severity, label: severityLabel(severity) }))}
              />
              <div className="field">
                <label htmlFor="acc-title">Titlu</label>
                <input
                  id="acc-title"
                  required
                  value={caseForm.title}
                  onChange={(e) => setCaseForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <EmployeeSelect
                id="acc-emp"
                label="Angajat (opțional)"
                value={caseForm.employeeId ?? ""}
                allowEmpty
                emptyLabel="Fără angajat asociat"
                onChange={(employeeId) => setCaseForm((p) => ({ ...p, employeeId: employeeId || undefined }))}
              />
              <div className="field">
                <label htmlFor="acc-occ">Data și ora evenimentului</label>
                <input
                  id="acc-occ"
                  type="datetime-local"
                  required
                  value={occurredLocal}
                  onChange={(e) =>
                    setCaseForm((p) => ({
                      ...p,
                      occurredAt: e.target.value ? fromDatetimeLocalValue(e.target.value) : p.occurredAt
                    }))
                  }
                />
              </div>
              <FieldSelect
                id="acc-worksite"
                label="Punct de lucru"
                value={caseForm.worksiteId ?? ""}
                allowEmpty
                emptyLabel="Selectează punct de lucru"
                onChange={(worksiteId) => {
                  const site = worksites.data?.items.find((item) => item.id === worksiteId);
                  setCaseForm((p) => ({
                    ...p,
                    worksiteId: worksiteId || undefined,
                    location: site ? `${site.code} — ${site.name}` : p.location
                  }));
                }}
                options={mapToOptions(
                  worksites.data?.items ?? [],
                  (item) => item.id,
                  (item) => `${item.code} — ${item.name}`
                )}
              />
              <FieldSelect
                id="acc-department"
                label="Departament"
                value={caseForm.departmentId ?? ""}
                allowEmpty
                emptyLabel="Selectează departament"
                onChange={(departmentId) => setCaseForm((p) => ({ ...p, departmentId: departmentId || undefined }))}
                options={mapToOptions(
                  departments.data?.items ?? [],
                  (item) => item.id,
                  (item) => `${item.code} — ${item.name}`
                )}
              />
              <div className="field">
                <label htmlFor="acc-location">Loc eveniment</label>
                <input
                  id="acc-location"
                  value={caseForm.location ?? ""}
                  onChange={(e) => setCaseForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Ex: Hale producție, linia 2"
                />
              </div>
              <div className="field">
                <label htmlFor="acc-research">Responsabil cercetare</label>
                <input
                  id="acc-research"
                  value={caseForm.researchResponsible ?? ""}
                  onChange={(e) => setCaseForm((p) => ({ ...p, researchResponsible: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="acc-witnesses">Martori (separați prin virgulă)</label>
                <input id="acc-witnesses" value={witnessesText} onChange={(e) => setWitnessesText(e.target.value)} />
              </div>

              {caseForm.type === "ACCIDENT" ? (
                <>
                  <div className="field">
                    <label htmlFor="acc-itm-days">Zile ITM</label>
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
                </>
              ) : null}

              {caseForm.type === "INCIDENT" ? (
                <>
                  <div className="field">
                    <label htmlFor="acc-factors">Factori contribuitori</label>
                    <textarea
                      id="acc-factors"
                      rows={3}
                      value={caseForm.contributingFactors ?? ""}
                      onChange={(e) => setCaseForm((p) => ({ ...p, contributingFactors: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="acc-immediate">Măsuri imediate</label>
                    <textarea
                      id="acc-immediate"
                      rows={3}
                      value={caseForm.immediateMeasures ?? ""}
                      onChange={(e) => setCaseForm((p) => ({ ...p, immediateMeasures: e.target.value }))}
                    />
                  </div>
                </>
              ) : null}

              {caseForm.type === "OCCUPATIONAL_DISEASE" ? (
                <>
                  <div className="field inline-check">
                    <input
                      id="acc-disease-confirmed"
                      type="checkbox"
                      checked={caseForm.diseaseConfirmed ?? false}
                      onChange={(e) => setCaseForm((p) => ({ ...p, diseaseConfirmed: e.target.checked }))}
                    />
                    <label htmlFor="acc-disease-confirmed">Boală profesională confirmată</label>
                  </div>
                  {caseForm.diseaseConfirmed ? (
                    <>
                      <div className="field">
                        <label htmlFor="acc-disease-at">Data confirmării</label>
                        <input
                          id="acc-disease-at"
                          type="datetime-local"
                          required
                          value={diseaseConfirmedLocal}
                          onChange={(e) =>
                            setCaseForm((p) => ({
                              ...p,
                              diseaseConfirmedAt: e.target.value
                                ? fromDatetimeLocalValue(e.target.value)
                                : undefined
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="acc-disease-by">Autoritate / medic</label>
                        <input
                          id="acc-disease-by"
                          value={caseForm.diseaseConfirmedBy ?? ""}
                          onChange={(e) => setCaseForm((p) => ({ ...p, diseaseConfirmedBy: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="acc-disease-doc">Document / referință</label>
                        <input
                          id="acc-disease-doc"
                          value={caseForm.diseaseDocumentRef ?? ""}
                          onChange={(e) => setCaseForm((p) => ({ ...p, diseaseDocumentRef: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              <div className="field">
                <label htmlFor="acc-desc">Descriere</label>
                <textarea
                  id="acc-desc"
                  rows={3}
                  required
                  value={caseForm.description}
                  onChange={(e) => setCaseForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <button className="btn-primary" type="submit" disabled={createCase.isPending}>
                {createCase.isPending ? "Se salvează..." : "Salvează caz"}
              </button>
              {createCase.isSuccess ? (
                <p className="feedback success" role="status">
                  Cazul a fost creat. Continuă cu cercetarea.
                </p>
              ) : null}
              {createCase.isError ? (
                <p className="feedback error" role="alert">
                  {mutationErrorMessage(createCase.error)}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "research" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <CaseContextBanner selectedCase={selectedCase} onClear={clearSelectedCase} />
            {!selectedCaseId ? (
              <FieldSelect
                id="research-case"
                label="Alege cazul"
                value={selectedCaseId}
                onChange={(id) => selectCase(id)}
                allowEmpty
                emptyLabel="Selectează caz"
                options={mapToOptions(
                  casesPaged.items ?? [],
                  (item) => item.id,
                  (item) => `${item.title} (${statusLabel(item.status)})`
                )}
              />
            ) : null}

            {selectedCase ? (
              <>
                <form className="form-stack" onSubmit={onAddTask}>
                  <h4 className="card-title">Adaugă task cercetare</h4>
                  <div className="field">
                    <label htmlFor="task-title">Task</label>
                    <input
                      id="task-title"
                      required
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-assigned">Responsabil</label>
                    <input
                      id="task-assigned"
                      value={taskForm.assignedTo ?? ""}
                      onChange={(e) => setTaskForm((p) => ({ ...p, assignedTo: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-due">Termen</label>
                    <input
                      id="task-due"
                      type="datetime-local"
                      required
                      value={taskDueLocal}
                      onChange={(e) =>
                        setTaskForm((p) => ({
                          ...p,
                          dueAt: e.target.value ? fromDatetimeLocalValue(e.target.value) : p.dueAt
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-notes">Note</label>
                    <textarea
                      id="task-notes"
                      rows={2}
                      value={taskForm.notes ?? ""}
                      onChange={(e) => setTaskForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={addTask.isPending}>
                    {addTask.isPending ? "Se adaugă..." : "Adaugă task"}
                  </button>
                  {addTask.isError ? (
                    <p className="feedback error" role="alert">
                      {mutationErrorMessage(addTask.error)}
                    </p>
                  ) : null}
                </form>

                <h4 className="card-title">Task-uri pe caz</h4>
                <div className="ssm-history-list">
                  {selectedCase.tasks.map((task) => (
                    <div key={task.id} className="ssm-history-item">
                      <div>
                        <strong>{task.title}</strong>
                        <div className="field-hint">
                          {task.assignedTo ? `${task.assignedTo} · ` : ""}
                          termen {toDateInputValue(task.dueAt)}
                          {task.notes ? ` · ${task.notes}` : ""}
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
                  {!selectedCase.tasks.length ? <p className="field-hint">Niciun task încă.</p> : null}
                </div>

                <button type="button" className="btn-secondary" onClick={() => setTab("measures")}>
                  Continuă la măsuri
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "measures" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <CaseContextBanner selectedCase={selectedCase} onClear={clearSelectedCase} />
            {!selectedCaseId ? (
              <FieldSelect
                id="measures-case"
                label="Alege cazul"
                value={selectedCaseId}
                onChange={(id) => selectCase(id)}
                allowEmpty
                emptyLabel="Selectează caz"
                options={mapToOptions(
                  casesPaged.items ?? [],
                  (item) => item.id,
                  (item) => `${item.title} (${statusLabel(item.status)})`
                )}
              />
            ) : null}

            {selectedCase ? (
              <>
                <form className="form-stack" onSubmit={onAddMeasure}>
                  <h4 className="card-title">Măsură corectivă</h4>
                  <div className="field">
                    <label htmlFor="measure-desc">Descriere</label>
                    <textarea
                      id="measure-desc"
                      rows={3}
                      required
                      value={measureForm.description}
                      onChange={(e) => setMeasureForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="measure-assigned">Responsabil</label>
                    <input
                      id="measure-assigned"
                      value={measureForm.assignedTo ?? ""}
                      onChange={(e) => setMeasureForm((p) => ({ ...p, assignedTo: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="measure-due">Termen</label>
                    <input
                      id="measure-due"
                      type="datetime-local"
                      required
                      value={measureDueLocal}
                      onChange={(e) =>
                        setMeasureForm((p) => ({
                          ...p,
                          dueAt: e.target.value ? fromDatetimeLocalValue(e.target.value) : p.dueAt
                        }))
                      }
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={addMeasure.isPending}>
                    {addMeasure.isPending ? "Se adaugă..." : "Adaugă măsură"}
                  </button>
                  {addMeasure.isError ? (
                    <p className="feedback error" role="alert">
                      {mutationErrorMessage(addMeasure.error)}
                    </p>
                  ) : null}
                </form>

                <div className="ssm-history-list">
                  {(selectedCase.correctiveMeasureItems ?? []).map((measure) => (
                    <div key={measure.id} className="ssm-history-item">
                      <div>
                        <strong>{measure.description}</strong>
                        <div className="field-hint">
                          {measure.assignedTo ? `${measure.assignedTo} · ` : ""}
                          termen {toDateInputValue(measure.dueAt)}
                        </div>
                      </div>
                      {!measure.completedAt ? (
                        <button type="button" className="btn-text" onClick={() => completeMeasure.mutate(measure.id)}>
                          Completează
                        </button>
                      ) : (
                        <span className="badge-good">Done</span>
                      )}
                    </div>
                  ))}
                  {!selectedCase.correctiveMeasureItems?.length ? (
                    <p className="field-hint">Nicio măsură corectivă încă.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {selectedCase && selectedCase.status !== "CLOSED" ? (
            <form className="card form-stack ssm-doc-card" onSubmit={onCloseCase}>
              <h4 className="card-title">Închidere și raport ITM</h4>
              <div className="field">
                <label htmlFor="close-conc">Concluzii cercetare</label>
                <textarea
                  id="close-conc"
                  rows={3}
                  required
                  value={closeForm.conclusions}
                  onChange={(e) => setCloseForm((p) => ({ ...p, conclusions: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="close-measures">Rezumat măsuri (opțional)</label>
                <textarea
                  id="close-measures"
                  rows={2}
                  value={closeForm.correctiveMeasures ?? ""}
                  onChange={(e) => setCloseForm((p) => ({ ...p, correctiveMeasures: e.target.value }))}
                />
              </div>
              <div className="ssm-inline-actions">
                <button type="submit" className="btn-primary" disabled={closeCase.isPending}>
                  {closeCase.isPending ? "Se închide..." : "Închide caz"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDownloadError(null);
                    void downloadWithAuth(
                      ssmApi.getAccidentReportUrl(selectedCase.id),
                      `accident-report-${selectedCase.id}.pdf`
                    ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)));
                  }}
                >
                  Export PDF ITM
                </button>
              </div>
              {closeCase.isError ? (
                <p className="feedback error" role="alert">
                  {mutationErrorMessage(closeCase.error)}
                </p>
              ) : null}
              {closeCase.isSuccess ? (
                <p className="feedback success" role="status">
                  Cazul a fost închis.
                </p>
              ) : null}
              {downloadError ? <p className="feedback error">{downloadError}</p> : null}
            </form>
          ) : null}

          {selectedCase?.status === "CLOSED" ? (
            <div className="card form-stack ssm-doc-card">
              <h4 className="card-title">Caz închis</h4>
              <p className="field-hint">{selectedCase.conclusions ?? "Fără concluzii."}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDownloadError(null);
                  void downloadWithAuth(
                    ssmApi.getAccidentReportUrl(selectedCase.id),
                    `accident-report-${selectedCase.id}.pdf`
                  ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)));
                }}
              >
                Export PDF ITM
              </button>
              {downloadError ? <p className="feedback error">{downloadError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="card form-stack ssm-doc-card">
          <div className="ssm-form-grid">
            <div className="field">
              <label htmlFor="stats-from">Perioadă de la</label>
              <input id="stats-from" type="date" value={statsFrom} onChange={(e) => setStatsFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="stats-to">Perioadă până la</label>
              <input id="stats-to" type="date" value={statsTo} onChange={(e) => setStatsTo(e.target.value)} />
            </div>
          </div>
          <div className="ssm-history-list">
            <div className="ssm-history-item">
              <strong>Total cazuri</strong>
              <span>{stats?.totalCases ?? 0}</span>
            </div>
            <div className="ssm-history-item">
              <strong>Cazuri deschise</strong>
              <span>{stats?.openCases ?? 0}</span>
            </div>
            <div className="ssm-history-item">
              <strong>Task-uri restante</strong>
              <span className={(stats?.overdueTasks ?? 0) > 0 ? "badge-bad" : "badge-good"}>
                {stats?.overdueTasks ?? 0}
              </span>
            </div>
            <div className="ssm-history-item">
              <strong>Măsuri restante</strong>
              <span className={(stats?.overdueMeasures ?? 0) > 0 ? "badge-bad" : "badge-good"}>
                {stats?.overdueMeasures ?? 0}
              </span>
            </div>
            <div className="ssm-history-item">
              <strong>Frecvență (acc. × 1000 / angajați)</strong>
              <span>{stats?.frequencyRate ?? "—"}</span>
            </div>
            <div className="ssm-history-item">
              <strong>Gravitate (zile ITM / accident)</strong>
              <span>{stats?.severityRate ?? "—"}</span>
            </div>
          </div>
          <div className="ssm-form-grid">
            <div>
              <strong>Pe tip</strong>
              <ul className="field-hint">
                <li>Accidente: {stats?.byType.ACCIDENT ?? 0}</li>
                <li>Incidente: {stats?.byType.INCIDENT ?? 0}</li>
                <li>Boli profesionale: {stats?.byType.OCCUPATIONAL_DISEASE ?? 0}</li>
              </ul>
            </div>
            <div>
              <strong>Pe severitate</strong>
              <ul className="field-hint">
                {ACCIDENT_SEVERITIES.map((sev) => (
                  <li key={sev}>
                    {severityLabel(sev)}: {stats?.bySeverity[sev] ?? 0}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Pe departament</strong>
              <ul className="field-hint">
                {(stats?.byDepartment ?? []).slice(0, 8).map((item) => (
                  <li key={item.key}>
                    {item.label}: {item.count}
                  </li>
                ))}
                {!stats?.byDepartment?.length ? <li>Nu există date</li> : null}
              </ul>
            </div>
            <div>
              <strong>Pe punct de lucru</strong>
              <ul className="field-hint">
                {(stats?.byWorksite ?? []).slice(0, 8).map((item) => (
                  <li key={item.key}>
                    {item.label}: {item.count}
                  </li>
                ))}
                {!stats?.byWorksite?.length ? <li>Nu există date</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
