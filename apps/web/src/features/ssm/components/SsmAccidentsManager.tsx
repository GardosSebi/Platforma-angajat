import { FormEvent, useCallback, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentCorrectiveMeasureRequest,
  CreateSsmAccidentTaskRequest,
  SsmAccidentAttachmentKind,
  SsmAccidentCaseItem,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { MasterDataCreateModal } from "../../master-data/components/MasterDataCreateModal";
import { useDepartmentsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { ssmApi } from "../api/ssm.api";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import {
  useAccidentAttachments,
  useAccidentCases,
  useAccidentStats,
  useAddAccidentCorrectiveMeasure,
  useAddAccidentTask,
  useCloseAccidentCase,
  useCompleteAccidentCorrectiveMeasure,
  useCompleteAccidentTask,
  useCreateAccidentCase,
  useDeleteAccidentAttachment,
  useUploadAccidentAttachment
} from "../hooks/useSsmAccidents";

type AccidentsTab = "register" | "stats";
type CaseSection = "research" | "evidence" | "measures" | "close";
type CaseAction = "task" | "evidence" | "measure" | "close";

const ACCIDENT_TABS: Array<{ id: AccidentsTab; title: string; caption: string }> = [
  { id: "register", title: "Registru", caption: "Cazuri, cercetare, măsuri" },
  { id: "stats", title: "Statistici", caption: "Frecvență și distribuții" }
];

const CASE_SECTIONS: Array<{ id: CaseSection; title: string }> = [
  { id: "research", title: "Cercetare" },
  { id: "evidence", title: "Probe" },
  { id: "measures", title: "Măsuri" },
  { id: "close", title: "Închidere" }
];

const ATTACHMENT_KINDS: SsmAccidentAttachmentKind[] = ["PHOTO", "PV", "EXPERTISE", "OTHER"];

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
      return "Incident periculos";
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

function attachmentKindLabel(kind: SsmAccidentAttachmentKind): string {
  switch (kind) {
    case "PHOTO":
      return "Poză / imagine";
    case "PV":
      return "Proces-verbal";
    case "EXPERTISE":
      return "Expertiză";
    case "OTHER":
      return "Alt document";
    default:
      return kind;
  }
}

function caseSummary(item: SsmAccidentCaseItem): string {
  return [
    typeLabel(item.type),
    severityLabel(item.severity),
    statusLabel(item.status),
    item.employeeName,
    item.location
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SsmAccidentsManager() {
  const session = useAuthSession();
  const canApprove = hasPermission(session?.roles, "ssm:accident:approve");
  const [tab, setTab] = useState<AccidentsTab>("register");
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
  const [caseSection, setCaseSection] = useState<CaseSection>("research");
  const [witnessesText, setWitnessesText] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [caseAction, setCaseAction] = useState<CaseAction | null>(null);
  const [attachmentKind, setAttachmentKind] = useState<SsmAccidentAttachmentKind>("PHOTO");
  const [attachmentNotes, setAttachmentNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const attachmentsQuery = useAccidentAttachments(selectedCaseId);
  const uploadAttachment = useUploadAccidentAttachment(selectedCaseId);
  const deleteAttachment = useDeleteAccidentAttachment(selectedCaseId);

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

  const caseAttachments = attachmentsQuery.data?.items ?? selectedCase?.attachments ?? [];

  const selectCase = (caseId: string, section: CaseSection = "research") => {
    addTask.reset();
    addMeasure.reset();
    closeCase.reset();
    uploadAttachment.reset();
    setDownloadError(null);
    setSelectedCaseId(caseId);
    setCaseSection(section);
    setTaskForm({ ...EMPTY_TASK, accidentCaseId: caseId });
    setMeasureForm({ ...EMPTY_MEASURE, accidentCaseId: caseId });
    setCloseForm(EMPTY_CLOSE);
    setAttachmentFile(null);
    setAttachmentNotes("");
    setCaseAction(null);
  };

  const closeCaseModal = useCallback(() => {
    setSelectedCaseId("");
    setCaseAction(null);
  }, []);
  const closeCaseAction = useCallback(() => setCaseAction(null), []);

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCaseForm({ ...EMPTY_CASE, occurredAt: new Date().toISOString() });
    setWitnessesText("");
  };

  const openCreateForm = () => {
    setCaseForm({ ...EMPTY_CASE, occurredAt: new Date().toISOString() });
    setWitnessesText("");
    setShowCreateForm(true);
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
        closeCreateForm();
        selectCase(created.id);
      }
    });
  };

  const onAddTask = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    addTask.mutate(
      {
        ...taskForm,
        accidentCaseId: selectedCaseId,
        assignedTo: taskForm.assignedTo?.trim() || undefined,
        notes: taskForm.notes?.trim() || undefined
      },
      {
        onSuccess: () => {
          setTaskForm({ ...EMPTY_TASK, title: "", accidentCaseId: selectedCaseId });
          setCaseAction(null);
        }
      }
    );
  };

  const onAddMeasure = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    addMeasure.mutate(
      {
        ...measureForm,
        accidentCaseId: selectedCaseId,
        assignedTo: measureForm.assignedTo?.trim() || undefined
      },
      {
        onSuccess: () => {
          setMeasureForm({ ...EMPTY_MEASURE, accidentCaseId: selectedCaseId });
          setCaseAction(null);
        }
      }
    );
  };

  const onUploadAttachment = (event: FormEvent) => {
    event.preventDefault();
    if (!attachmentFile || !selectedCaseId) return;
    uploadAttachment.mutate(
      { kind: attachmentKind, notes: attachmentNotes.trim() || undefined, file: attachmentFile },
      {
        onSuccess: () => {
          setAttachmentFile(null);
          setAttachmentNotes("");
          setCaseAction(null);
        }
      }
    );
  };

  const onCloseCase = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaseId) return;
    closeCase.mutate(
      {
        caseId: selectedCaseId,
        payload: {
          conclusions: closeForm.conclusions,
          correctiveMeasures: closeForm.correctiveMeasures?.trim() || undefined
        }
      },
      { onSuccess: () => setCaseAction(null) }
    );
  };

  const stats = statsQuery.data;

  return (
    <section className="ssm-eip-panel" aria-label="Modul accidente">
      <div className="ssm-panel-tabs ssm-panel-tabs--2" role="tablist" aria-label="Secțiuni accidente">
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

      {tab === "register" ? (
        <>
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Cazuri înregistrate
              </h4>
              <button type="button" className="btn-primary" onClick={openCreateForm}>
                Caz nou
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
                    <button type="button" className="btn-text" onClick={() => selectCase(item.id)}>
                      Deschide dosarul
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
            <MasterDataCreateModal
              title="Înregistrare caz nou"
              titleId="ssm-accident-create-title"
              size="wide"
              onClose={closeCreateForm}
            >
              <form className="form-stack" onSubmit={onCreateCase}>
                <FieldSelect
                  id="acc-type"
                  label="Tip"
                  value={caseForm.type}
                  onChange={(type) => setCaseForm((p) => ({ ...p, type: type as SsmAccidentType }))}
                  options={ACCIDENT_TYPES.map((type) => ({ value: type, label: typeLabel(type) }))}
                  hint={
                    caseForm.type === "INCIDENT"
                      ? "Include evenimente fără accident (near-miss). Nu există etichetă separată — se înregistrează ca incident."
                      : undefined
                  }
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
                <div className="comms-compose-actions">
                  <button className="btn-primary" type="submit" disabled={createCase.isPending}>
                    {createCase.isPending ? "Se salvează..." : "Salvează caz"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                    Anulează
                  </button>
                </div>
                {createCase.isError ? (
                  <p className="feedback error" role="alert">
                    {mutationErrorMessage(createCase.error)}
                  </p>
                ) : null}
              </form>
            </MasterDataCreateModal>
          ) : null}
        </>
      ) : null}

      {selectedCase ? (
        <MasterDataCreateModal
          title={selectedCase.title}
          titleId="ssm-accident-case-title"
          description={caseSummary(selectedCase)}
          size="wide"
          onClose={closeCaseModal}
        >
          <div className="ssm-inline-actions" role="tablist" aria-label="Secțiuni dosar caz">
            {CASE_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={caseSection === item.id}
                className={caseSection === item.id ? "btn-primary" : "btn-secondary"}
                onClick={() => setCaseSection(item.id)}
              >
                {item.id === "research"
                  ? `${item.title} (${selectedCase.tasks.length})`
                  : item.id === "evidence"
                    ? `${item.title} (${caseAttachments.length})`
                    : item.id === "measures"
                      ? `${item.title} (${selectedCase.correctiveMeasureItems?.length ?? 0})`
                      : item.title}
              </button>
            ))}
          </div>

          {caseSection === "research" ? (
            <>
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
                      <span className="badge-good">Finalizat</span>
                    )}
                  </div>
                ))}
                {!selectedCase.tasks.length ? <p className="field-hint">Niciun task de cercetare încă.</p> : null}
              </div>

              {selectedCase.status !== "CLOSED" ? (
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-primary" onClick={() => setCaseAction("task")}>
                    Task nou
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {caseSection === "evidence" ? (
            <>
              <div className="ssm-history-list">
                {caseAttachments.map((att) => (
                  <div key={att.id} className="ssm-history-item">
                    <div>
                      <strong>{attachmentKindLabel(att.kind)}</strong>
                      <div className="field-hint">
                        {att.fileName}
                        {att.notes ? ` · ${att.notes}` : ""}
                        {att.createdAt ? ` · ${new Date(att.createdAt).toLocaleString("ro-RO")}` : ""}
                      </div>
                    </div>
                    <div className="ssm-inline-actions">
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => {
                          setDownloadError(null);
                          void downloadWithAuth(
                            ssmApi.getAccidentAttachmentUrl(selectedCase.id, att.id),
                            att.fileName
                          ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)));
                        }}
                      >
                        Descarcă
                      </button>
                      {selectedCase.status !== "CLOSED" ? (
                        <button type="button" className="btn-text" onClick={() => deleteAttachment.mutate(att.id)}>
                          Șterge
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!caseAttachments.length ? <p className="field-hint">Nicio poză, PV sau expertiză pe dosar.</p> : null}
              </div>
              {deleteAttachment.isError ? (
                <p className="feedback error">{mutationErrorMessage(deleteAttachment.error)}</p>
              ) : null}

              {selectedCase.status !== "CLOSED" ? (
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-primary" onClick={() => setCaseAction("evidence")}>
                    Probă nouă
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {caseSection === "measures" ? (
            <>
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
                      <span className="badge-good">Finalizată</span>
                    )}
                  </div>
                ))}
                {!selectedCase.correctiveMeasureItems?.length ? (
                  <p className="field-hint">Nicio măsură corectivă încă.</p>
                ) : null}
              </div>

              {selectedCase.status !== "CLOSED" ? (
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-primary" onClick={() => setCaseAction("measure")}>
                    Măsură nouă
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {caseSection === "close" ? (
            <div className="form-stack">
              {selectedCase.status === "CLOSED" ? (
                <div className="field">
                  <span className="field-label">Concluzii</span>
                  <p className="field-hint">{selectedCase.conclusions ?? "Fără concluzii."}</p>
                </div>
              ) : canApprove ? (
                <div className="ssm-wizard-actions">
                  <button type="button" className="btn-primary" onClick={() => setCaseAction("close")}>
                    Închide cazul
                  </button>
                </div>
              ) : (
                <p className="field-hint">Închiderea cazului cere drept de aprobare.</p>
              )}
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDownloadError(null);
                    void downloadWithAuth(
                      ssmApi.getAccidentReportUrl(selectedCase.id),
                      `proces-verbal-cercetare-art128.pdf`
                    ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)));
                  }}
                >
                  Proces-verbal cercetare (art. 128)
                </button>
              </div>
            </div>
          ) : null}

          {downloadError ? <p className="feedback error">{downloadError}</p> : null}

          {caseAction === "task" && selectedCase.status !== "CLOSED" ? (
            <MasterDataCreateModal title="Task nou" titleId="accident-task-modal" stacked onClose={closeCaseAction}>
              <form className="form-stack" onSubmit={onAddTask}>
                <div className="field">
                  <label htmlFor="task-title">Task</label>
                  <input
                    id="task-title"
                    required
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-assigned">Responsabil</label>
                  <input
                    id="task-assigned"
                    value={taskForm.assignedTo ?? ""}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-due">Termen</label>
                  <input
                    id="task-due"
                    type="datetime-local"
                    required
                    value={taskDueLocal}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        dueAt: event.target.value ? fromDatetimeLocalValue(event.target.value) : prev.dueAt
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-notes">Note</label>
                  <input
                    id="task-notes"
                    value={taskForm.notes ?? ""}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, notes: event.target.value }))}
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
            </MasterDataCreateModal>
          ) : null}

          {caseAction === "evidence" && selectedCase.status !== "CLOSED" ? (
            <MasterDataCreateModal title="Probă nouă" titleId="accident-evidence-modal" stacked onClose={closeCaseAction}>
              <form className="form-stack" onSubmit={onUploadAttachment}>
                <FieldSelect
                  id="att-kind"
                  label="Tip"
                  value={attachmentKind}
                  onChange={(kind) => setAttachmentKind(kind as SsmAccidentAttachmentKind)}
                  options={ATTACHMENT_KINDS.map((kind) => ({
                    value: kind,
                    label: attachmentKindLabel(kind)
                  }))}
                />
                <div className="field">
                  <label htmlFor="att-file">Fișier (PDF, imagine, DOC)</label>
                  <input
                    id="att-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,image/*,application/pdf"
                    required
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="att-notes">Note (opțional)</label>
                  <input
                    id="att-notes"
                    value={attachmentNotes}
                    onChange={(event) => setAttachmentNotes(event.target.value)}
                    placeholder="ex. PV cercetare semnat, expertiză tehnică"
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={uploadAttachment.isPending || !attachmentFile}>
                  {uploadAttachment.isPending ? "Se încarcă..." : "Încarcă"}
                </button>
                {uploadAttachment.isError ? (
                  <p className="feedback error" role="alert">
                    {mutationErrorMessage(uploadAttachment.error)}
                  </p>
                ) : null}
              </form>
            </MasterDataCreateModal>
          ) : null}

          {caseAction === "measure" && selectedCase.status !== "CLOSED" ? (
            <MasterDataCreateModal
              title="Măsură corectivă nouă"
              titleId="accident-measure-modal"
              stacked
              onClose={closeCaseAction}
            >
              <form className="form-stack" onSubmit={onAddMeasure}>
                <div className="field">
                  <label htmlFor="measure-desc">Descriere</label>
                  <textarea
                    id="measure-desc"
                    rows={3}
                    required
                    value={measureForm.description}
                    onChange={(event) => setMeasureForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="measure-assigned">Responsabil</label>
                  <input
                    id="measure-assigned"
                    value={measureForm.assignedTo ?? ""}
                    onChange={(event) => setMeasureForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="measure-due">Termen</label>
                  <input
                    id="measure-due"
                    type="datetime-local"
                    required
                    value={measureDueLocal}
                    onChange={(event) =>
                      setMeasureForm((prev) => ({
                        ...prev,
                        dueAt: event.target.value ? fromDatetimeLocalValue(event.target.value) : prev.dueAt
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
            </MasterDataCreateModal>
          ) : null}

          {caseAction === "close" && selectedCase.status !== "CLOSED" && canApprove ? (
            <MasterDataCreateModal title="Închide cazul" titleId="accident-close-modal" stacked onClose={closeCaseAction}>
              <form className="form-stack" onSubmit={onCloseCase}>
                <div className="field">
                  <label htmlFor="close-conc">Concluzii cercetare</label>
                  <textarea
                    id="close-conc"
                    rows={4}
                    required
                    value={closeForm.conclusions}
                    onChange={(event) => setCloseForm((prev) => ({ ...prev, conclusions: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="close-measures">Rezumat măsuri (opțional)</label>
                  <textarea
                    id="close-measures"
                    rows={3}
                    value={closeForm.correctiveMeasures ?? ""}
                    onChange={(event) => setCloseForm((prev) => ({ ...prev, correctiveMeasures: event.target.value }))}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={closeCase.isPending}>
                  {closeCase.isPending ? "Se închide..." : "Închide cazul"}
                </button>
                {closeCase.isError ? (
                  <p className="feedback error" role="alert">
                    {mutationErrorMessage(closeCase.error)}
                  </p>
                ) : null}
              </form>
            </MasterDataCreateModal>
          ) : null}
        </MasterDataCreateModal>
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
