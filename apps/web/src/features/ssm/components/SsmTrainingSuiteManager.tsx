import { FormEvent, useEffect, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CreateSsmTrainingPlanRequest,
  CreateSsmTrainingTypeRequest,
  SsmTrainingCategory,
  SsmTrainingPlanItem,
  SsmTrainingTestQuestionInput
} from "@repo/shared-types/ssm";
import type { SsmTrainingTestQuestionPublic } from "@repo/shared-types/ssm-training-test";
import { trainingCategoryLabel, trainingCategoryMeta } from "@repo/shared-types/ssm-training-catalog";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { MasterDataCreateModal } from "../../master-data/components/MasterDataCreateModal";
import { TrainingTypeSelect } from "./TrainingTypeSelect";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import {
  useCompleteTest,
  useCreateTrainingPlan,
  useCreateTrainingType,
  useDispatchTrainingReminders,
  useGenerateCollectiveSheet,
  useMaterialComplete,
  useSignPlan,
  useSignPlansBatch,
  useStartMaterial,
  useStartTest,
  useTrainingCalendar,
  useTrainingCompliance,
  useTrainingPlans,
  useTrainingReminders,
  useTrainingTypes,
  useUpdateTrainingType,
  useUploadTrainingMaterial
} from "../hooks/useSsmTrainingSuite";
import { ssmApi } from "../api/ssm.api";
import { SsmTrainingTestPanel } from "./SsmTrainingTestPanel";
import { TrainingMaterialViewer } from "./TrainingMaterialViewer";
import { TrainingTestQuestionsEditor } from "./TrainingTestQuestionsEditor";
import { planHasMaterial, planWorkflowLabel } from "../../employee-portal/utils";

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

const TRAINING_CATEGORIES: SsmTrainingCategory[] = [
  "INTRODUCTORY_GENERAL",
  "WORKPLACE",
  "PERIODIC",
  "SUPPLEMENTARY",
  "EMERGENCY_PSI"
];

type TrainingTab = "track" | "plan" | "types" | "flow" | "dossier";

const TRAINING_TABS: Array<{ id: TrainingTab; title: string; caption: string; adminOnly?: boolean }> = [
  { id: "track", title: "Urmărire", caption: "Planuri, scadențe, conformitate" },
  { id: "plan", title: "Planificare", caption: "Alocare și fișă colectivă", adminOnly: true },
  { id: "types", title: "Catalog tipuri", caption: "Cod, categorie, test", adminOnly: true },
  { id: "flow", title: "Flux e-learning", caption: "Material, test, semnături" },
  { id: "dossier", title: "Dosar digital", caption: "Fișe și export ZIP" }
];

const defaultPlan = (trainingTypeId = "", employeeId = ""): CreateSsmTrainingPlanRequest => ({
  employeeId,
  trainingTypeId,
  scheduledAt: new Date().toISOString(),
  dueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  materialTitle: "Material instruire",
  materialUrl: ""
});

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function planStatusLabel(status: SsmTrainingPlanItem["status"]): string {
  switch (status) {
    case "PENDING":
      return "În curs";
    case "COMPLETED":
      return "Finalizată";
    case "OVERDUE":
      return "Expirată";
    case "BLOCKED":
      return "Blocată";
    default:
      return status;
  }
}

function planStatusClass(status: SsmTrainingPlanItem["status"]): string {
  if (status === "COMPLETED") return "ssm-chip good";
  if (status === "OVERDUE" || status === "BLOCKED") return "ssm-chip bad";
  return "ssm-chip warn";
}

export function SsmTrainingSuiteManager() {
  const session = useAuthSession();
  const resolvedEmployeeId = session?.linkedEmployeeId ?? DEMO_EMPLOYEE_ID;
  const showCatalogForms = hasPermission(session?.roles, "ssm:training:assign");
  const canApproveTraining = hasPermission(session?.roles, "ssm:training:approve");
  const canSignAsEmployee = hasPermission(session?.roles, "ssm:training:edit");

  const visibleTabs = useMemo(
    () => TRAINING_TABS.filter((item) => !item.adminOnly || showCatalogForms),
    [showCatalogForms]
  );

  const [tab, setTab] = useState<TrainingTab>("track");
  const activeTabMeta = visibleTabs.find((item) => item.id === tab) ?? visibleTabs[0] ?? TRAINING_TABS[0];

  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "track");
    }
  }, [visibleTabs, tab]);

  const plansPage = usePagination();
  const typesQuery = useTrainingTypes();
  const plansQuery = useTrainingPlans(plansPage.params);
  const plansPaged = paginationFromResult(plansQuery.data, plansPage.page, plansPage.pageSize);
  const calendarQuery = useTrainingCalendar();
  const remindersQuery = useTrainingReminders();
  const complianceQuery = useTrainingCompliance();

  const createType = useCreateTrainingType();
  const updateType = useUpdateTrainingType();
  const createPlan = useCreateTrainingPlan();
  const completeMaterial = useMaterialComplete();
  const startMaterial = useStartMaterial();
  const uploadMaterial = useUploadTrainingMaterial();
  const generateCollective = useGenerateCollectiveSheet();
  const startTest = useStartTest();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();
  const signBatch = useSignPlansBatch();
  const dispatchReminders = useDispatchTrainingReminders();

  const defaultTypeMeta = trainingCategoryMeta("PERIODIC");
  const emptyTypeForm = (): CreateSsmTrainingTypeRequest => ({
    code: "GEN-SSM",
    name: "Instruire generală SSM",
    category: "PERIODIC",
    legalMinDurationHours: defaultTypeMeta?.defaultLegalHours,
    recurrenceDays: defaultTypeMeta?.defaultRecurrenceDays ?? 365,
    reminderDays: defaultTypeMeta?.defaultReminderDays ?? [30, 15, 7],
    testQuestions: []
  });
  const [typeForm, setTypeForm] = useState<CreateSsmTrainingTypeRequest>(emptyTypeForm);
  const [editingTypeId, setEditingTypeId] = useState("");
  const [planForm, setPlanForm] = useState<CreateSsmTrainingPlanRequest>(defaultPlan());
  const [collectiveForm, setCollectiveForm] = useState({
    title: "Instructaj vizitatori / colaboratori",
    trainerName: "",
    trainerFunction: "",
    location: "",
    visitDates: "",
    attendeesText: ""
  });
  const [activePlanId, setActivePlanId] = useState("");
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);
  const [testQuestions, setTestQuestions] = useState<SsmTrainingTestQuestionPublic[]>([]);
  const [testResult, setTestResult] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
  } | null>(null);
  const [signature, setSignature] = useState("");
  const [digitalEmployeeId, setDigitalEmployeeId] = useState(resolvedEmployeeId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<{
    trainings: Array<{ id: string; type: string; status: string; score?: number | null }>;
    documents: Array<{ id: string; title: string; type: string; fileName?: string }>;
    eipRecords?: Array<{ id: string }>;
    medicalControls?: Array<{ id: string }>;
  } | null>(null);
  const [showTestEditor, setShowTestEditor] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showCollectiveForm, setShowCollectiveForm] = useState(false);

  const planOptions = plansPaged.items;
  const activePlan = planOptions.find((p) => p.id === activePlanId) ?? planOptions[0];
  const compliance = complianceQuery.data;

  const employeesQuery = useEmployeeOptions();
  const employeeOptions = employeesQuery.data?.items ?? [];

  useEffect(() => {
    setDigitalEmployeeId(resolvedEmployeeId);
    if (resolvedEmployeeId) {
      setPlanForm((prev) => ({ ...prev, employeeId: resolvedEmployeeId }));
    }
  }, [resolvedEmployeeId]);

  useEffect(() => {
    if (!planForm.employeeId && employeeOptions[0]?.id) {
      setPlanForm((prev) => ({ ...prev, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, planForm.employeeId]);

  useEffect(() => {
    if (!activePlanId && planOptions[0]?.id) {
      setActivePlanId(planOptions[0].id);
    }
  }, [activePlanId, planOptions]);

  useEffect(() => {
    if (activePlan?.id) {
      setTestQuestions([]);
      setTestResult(null);
      setTestStartedAt(null);
    }
  }, [activePlan?.id]);

  useEffect(() => {
    if (activePlan?.score != null && activePlan.status !== "BLOCKED") {
      setTestResult({
        score: activePlan.score,
        passed: true,
        correctCount: 0,
        totalCount: 0
      });
    }
  }, [activePlan?.id, activePlan?.score, activePlan?.status]);

  const calendarBuckets = useMemo(() => {
    const events = calendarQuery.data?.events ?? [];
    return {
      overdue: events.filter((e) => e.status === "OVERDUE"),
      inProgress: events.filter((e) => e.status === "PENDING")
    };
  }, [calendarQuery.data?.events]);

  const onCategoryChange = (category: SsmTrainingCategory) => {
    const meta = trainingCategoryMeta(category);
    setTypeForm((prev) => ({
      ...prev,
      category,
      legalMinDurationHours: meta?.defaultLegalHours ?? prev.legalMinDurationHours,
      recurrenceDays: meta?.defaultRecurrenceDays ?? prev.recurrenceDays,
      reminderDays: meta?.defaultReminderDays ?? prev.reminderDays
    }));
  };

  const closeTypeForm = () => {
    setShowTypeForm(false);
    setEditingTypeId("");
    setShowTestEditor(false);
    setTypeForm(emptyTypeForm());
  };

  const openNewTypeForm = () => {
    setEditingTypeId("");
    setShowTestEditor(false);
    setTypeForm(emptyTypeForm());
    setShowTypeForm(true);
  };

  const onCreateType = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateSsmTrainingTypeRequest = {
      ...typeForm,
      testQuestions: (typeForm.testQuestions ?? []).filter(
        (q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2
      )
    };
    if (editingTypeId) {
      updateType.mutate(
        {
          typeId: editingTypeId,
          payload: {
            name: payload.name,
            category: payload.category,
            legalMinDurationHours: payload.legalMinDurationHours,
            recurrenceDays: payload.recurrenceDays,
            reminderDays: payload.reminderDays,
            testQuestions: payload.testQuestions
          }
        },
        {
          onSuccess: () => {
            closeTypeForm();
          }
        }
      );
      return;
    }
    createType.mutate(payload, {
      onSuccess: (created) => {
        setPlanForm((prev) => ({ ...prev, trainingTypeId: created.id }));
        closeTypeForm();
      }
    });
  };

  const onLoadTypeForEdit = (typeId: string) => {
    const type = (typesQuery.data ?? []).find((t) => t.id === typeId);
    if (!type) return;
    setEditingTypeId(type.id);
    setTypeForm({
      code: type.code,
      name: type.name,
      category: type.category,
      legalMinDurationHours: type.legalMinDurationHours ?? undefined,
      recurrenceDays: type.recurrenceDays ?? undefined,
      reminderDays: type.reminderDays,
      testQuestions: (type.testQuestions as SsmTrainingTestQuestionInput[] | null) ?? []
    });
    setShowTestEditor(Boolean(type.testQuestions?.length));
    setShowTypeForm(true);
  };

  const onCreatePlan = (event: FormEvent) => {
    event.preventDefault();
    createPlan.mutate(planForm, {
      onSuccess: (data) => {
        setActivePlanId(data.id);
        setTab("flow");
      }
    });
  };

  const onGenerateCollective = (event: FormEvent) => {
    event.preventDefault();
    const attendees = collectiveForm.attendeesText
      .split(/\r?\n|;|,/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!attendees.length) return;
    generateCollective.mutate({
      title: collectiveForm.title.trim(),
      trainerName: collectiveForm.trainerName.trim() || undefined,
      trainerFunction: collectiveForm.trainerFunction.trim() || undefined,
      location: collectiveForm.location.trim() || undefined,
      visitDates: collectiveForm.visitDates.trim() || undefined,
      attendees
    });
  };

  const onStartElearning = () => {
    if (!activePlan?.id) return;
    startTest.mutate(activePlan.id, {
      onSuccess: (data) => {
        setTestStartedAt(Date.now());
        setTestQuestions(data.questions);
        setTestResult(null);
      }
    });
  };

  const onCompleteTest = (answers: Record<string, number>) => {
    if (!activePlan?.id) return;
    const durationSeconds = testStartedAt
      ? Math.max(60, Math.round((Date.now() - testStartedAt) / 1000))
      : 900;
    completeTest.mutate(
      { trainingPlanId: activePlan.id, answers, durationSeconds },
      {
        onSuccess: (data) => {
          setTestResult(data);
          setTestQuestions([]);
        }
      }
    );
  };

  const materialReady = activePlan
    ? !planHasMaterial(activePlan) || Boolean(activePlan.materialCompletedAt)
    : false;

  const openFlow = (planId: string) => {
    setActivePlanId(planId);
    setTab("flow");
  };

  return (
    <section className="ssm-eip-panel" aria-label="Modul instruire SSM">
      <div
        className={`ssm-panel-tabs${visibleTabs.length >= 5 ? " ssm-panel-tabs--5" : ""}`}
        role="tablist"
        aria-label="Secțiuni instruire"
      >
        {visibleTabs.map((item) => (
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

      {tab === "track" ? (
        <div className="ssm-panel-layout">
          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <h4 className="card-title">Instruiri planificate</h4>
              {showCatalogForms ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => dispatchReminders.mutate()}
                  disabled={dispatchReminders.isPending}
                >
                  {dispatchReminders.isPending ? "Se trimit…" : "Trimite remindere"}
                </button>
              ) : null}
            </div>
            <p className="field-hint">
              Conformitate {compliance?.summary.compliantPercent ?? "—"}% ·{" "}
              {compliance?.summary.blockedAdmissionCount ?? 0} blocări admitere ·{" "}
              {remindersQuery.data?.reminders.length ?? 0} remindere
            </p>
            <div className="ssm-doc-items">
              {planOptions.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`ssm-doc-item ${activePlanId === plan.id ? "selected" : ""}`}
                  onClick={() => openFlow(plan.id)}
                >
                  <strong>
                    {plan.employeeName} — {plan.trainingTypeName}
                  </strong>
                  <span>
                    {planStatusLabel(plan.status)} · scadență {new Date(plan.dueAt).toLocaleDateString("ro-RO")}
                    {plan.blockedAdmission ? " · blocare admitere" : ""}
                  </span>
                  <span className={planStatusClass(plan.status)}>{plan.status}</span>
                </button>
              ))}
              {!planOptions.length ? <p className="field-hint">Nicio instruire planificată.</p> : null}
            </div>
            <PaginationBar
              page={plansPaged.page}
              pageSize={plansPaged.pageSize}
              total={plansPaged.total}
              totalPages={plansPaged.totalPages}
              onPageChange={plansPage.setPage}
              onPageSizeChange={plansPage.setPageSize}
              disabled={plansQuery.isFetching}
            />
          </div>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Scadențe și conformitate</h4>
            <h5 className="ssm-subtitle">Expirate ({calendarBuckets.overdue.length})</h5>
            <div className="ssm-history-list">
              {calendarBuckets.overdue.slice(0, 6).map((e) => (
                <div key={e.id} className="ssm-history-item">
                  <div>
                    <button type="button" className="ssm-link-btn" onClick={() => openFlow(e.id)}>
                      {e.title}
                    </button>
                    <div className="field-hint">{new Date(e.dueAt).toLocaleDateString("ro-RO")}</div>
                  </div>
                  <span className="ssm-chip bad">Expirată</span>
                </div>
              ))}
              {!calendarBuckets.overdue.length ? <p className="field-hint">Nicio instruire expirată.</p> : null}
            </div>

            <h5 className="ssm-subtitle">În curs ({calendarBuckets.inProgress.length})</h5>
            <div className="ssm-history-list">
              {calendarBuckets.inProgress.slice(0, 6).map((e) => (
                <div key={e.id} className="ssm-history-item">
                  <div>
                    <button type="button" className="ssm-link-btn" onClick={() => openFlow(e.id)}>
                      {e.trainingTypeName} — {e.employeeName}
                    </button>
                    <div className="field-hint">până la {new Date(e.dueAt).toLocaleDateString("ro-RO")}</div>
                  </div>
                </div>
              ))}
              {!calendarBuckets.inProgress.length ? <p className="field-hint">Nicio instruire în curs.</p> : null}
            </div>

            <h5 className="ssm-subtitle">Conformitate pe departament</h5>
            <div className="ssm-history-list">
              {(compliance?.byDepartment ?? []).map((dept) => (
                <div key={dept.departmentId ?? "none"} className="ssm-history-item">
                  <div>
                    <strong>{dept.departmentName}</strong>
                    <div className="field-hint">
                      {dept.complianceScore}% · {dept.blockedCount} blocări
                    </div>
                  </div>
                  <span className="ssm-chip">{dept.employeeCount} angajați</span>
                </div>
              ))}
              {!compliance?.byDepartment?.length ? (
                <p className="field-hint">Nu există date de conformitate.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "plan" && showCatalogForms ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onCreatePlan}>
            <h4 className="card-title">Alocare instruire</h4>
            <EmployeeSelect
              id="plan-employee"
              label="Angajat"
              value={planForm.employeeId}
              required
              onChange={(employeeId) => setPlanForm((p) => ({ ...p, employeeId }))}
            />
            <TrainingTypeSelect
              id="plan-type"
              label="Tip instruire"
              value={planForm.trainingTypeId}
              valueField="id"
              allowEmpty
              emptyLabel="Selectează tip"
              activeOnly={false}
              onChange={(trainingTypeId) => setPlanForm((p) => ({ ...p, trainingTypeId }))}
            />
            <div className="field">
              <label htmlFor="plan-material-title">Titlu material</label>
              <input
                id="plan-material-title"
                value={planForm.materialTitle ?? ""}
                onChange={(e) => setPlanForm((p) => ({ ...p, materialTitle: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-material-url">URL material (opțional)</label>
              <input
                id="plan-material-url"
                type="url"
                value={planForm.materialUrl ?? ""}
                onChange={(e) => setPlanForm((p) => ({ ...p, materialUrl: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-sched">Planificat la</label>
              <input
                id="plan-sched"
                type="datetime-local"
                value={planForm.scheduledAt.slice(0, 16)}
                onChange={(e) =>
                  setPlanForm((p) => ({ ...p, scheduledAt: new Date(e.target.value).toISOString() }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="plan-due">Scadență</label>
              <input
                id="plan-due"
                type="datetime-local"
                value={planForm.dueAt.slice(0, 16)}
                onChange={(e) => setPlanForm((p) => ({ ...p, dueAt: new Date(e.target.value).toISOString() }))}
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={createPlan.isPending || !planForm.trainingTypeId || !planForm.employeeId}
            >
              {createPlan.isPending ? "Se planifică…" : "Planifică instruire"}
            </button>
            {createPlan.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(createPlan.error)}
              </p>
            ) : null}
          </form>

          <div className="card form-stack ssm-doc-card">
            <div className="ssm-card-header">
              <h4 className="card-title">Fișă colectivă Anexa 12 HG 1425/2006</h4>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCollectiveForm((v) => !v)}
              >
                {showCollectiveForm ? "Ascunde formular" : "Generează PDF"}
              </button>
            </div>
            {showCollectiveForm ? (
              <form className="form-stack" onSubmit={onGenerateCollective}>
                <div className="field">
                  <label htmlFor="collective-title">Tematică</label>
                  <input
                    id="collective-title"
                    value={collectiveForm.title}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="collective-trainer">Instructor</label>
                  <input
                    id="collective-trainer"
                    value={collectiveForm.trainerName}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, trainerName: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="collective-function">Funcția instructorului</label>
                  <input
                    id="collective-function"
                    value={collectiveForm.trainerFunction}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, trainerFunction: e.target.value }))}
                    placeholder="lucrător desemnat / responsabil SSM"
                  />
                </div>
                <div className="field">
                  <label htmlFor="collective-location">Locație / proveniență grup</label>
                  <input
                    id="collective-location"
                    value={collectiveForm.location}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="collective-dates">Zilele vizitei / prezenței</label>
                  <input
                    id="collective-dates"
                    value={collectiveForm.visitDates}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, visitDates: e.target.value }))}
                    placeholder="ex. 25–26.08.2026"
                  />
                </div>
                <div className="field">
                  <label htmlFor="collective-attendees">Participanți (câte unul pe linie; opțional „Nume | CI/grupă sanguină”)</label>
                  <textarea
                    id="collective-attendees"
                    rows={5}
                    value={collectiveForm.attendeesText}
                    onChange={(e) => setCollectiveForm((p) => ({ ...p, attendeesText: e.target.value }))}
                    required
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={generateCollective.isPending}>
                  {generateCollective.isPending ? "Se generează…" : "Descarcă PDF"}
                </button>
                {generateCollective.isError ? (
                  <p className="feedback error">{mutationErrorMessage(generateCollective.error)}</p>
                ) : null}
              </form>
            ) : (
              <p className="field-hint">
                Generează Anexa nr. 12 la HG 1425/2006 — fișa de instruire colectivă pentru vizitatori / lucrători din întreprinderi externe.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "types" && showCatalogForms ? (
        <>
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-card-header">
              <h4 className="card-title">Tipuri configurate</h4>
              <button type="button" className="btn-primary" onClick={openNewTypeForm}>
                Tip nou
              </button>
            </div>
            <div className="ssm-history-list">
              {(typesQuery.data ?? []).map((t) => (
                <div key={t.id} className="ssm-history-item">
                  <div>
                    <strong>
                      {t.code} — {t.name}
                    </strong>
                    <div className="field-hint">
                      {trainingCategoryLabel(t.category)}
                      {t.legalMinDurationHours ? ` · ${t.legalMinDurationHours} ore` : ""}
                      {t.recurrenceDays ? ` · la ${t.recurrenceDays} zile` : ""}
                      {t.testQuestions?.length ? ` · ${t.testQuestions.length} întrebări custom` : ""}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => onLoadTypeForEdit(t.id)}>
                    Editează
                  </button>
                </div>
              ))}
              {!typesQuery.data?.length ? <p className="field-hint">Nu există tipuri. Adaugă primul tip.</p> : null}
            </div>
          </div>

          {showTypeForm ? (
            <MasterDataCreateModal
              title={editingTypeId ? "Editează tip" : "Tip instruire nou"}
              titleId="ssm-training-type-modal-title"
              size={showTestEditor ? "wide" : "default"}
              onClose={closeTypeForm}
            >
              <form className="form-stack" onSubmit={onCreateType}>
                <div className="field">
                  <label htmlFor="training-code">Cod</label>
                  <input
                    id="training-code"
                    value={typeForm.code}
                    disabled={Boolean(editingTypeId)}
                    onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="training-name">Denumire</label>
                  <input
                    id="training-name"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <FieldSelect
                  id="training-category"
                  label="Categorie legală"
                  value={typeForm.category ?? "PERIODIC"}
                  onChange={(category) => onCategoryChange(category as SsmTrainingCategory)}
                  options={TRAINING_CATEGORIES.map((category) => ({
                    value: category,
                    label: trainingCategoryLabel(category)
                  }))}
                />
                <div className="field">
                  <label htmlFor="training-legal-hours">Ore minime</label>
                  <input
                    id="training-legal-hours"
                    type="number"
                    min={0}
                    value={typeForm.legalMinDurationHours ?? ""}
                    onChange={(e) =>
                      setTypeForm((p) => ({
                        ...p,
                        legalMinDurationHours: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="training-rec">Recurență (zile)</label>
                  <input
                    id="training-rec"
                    type="number"
                    value={typeForm.recurrenceDays ?? ""}
                    onChange={(e) =>
                      setTypeForm((p) => ({
                        ...p,
                        recurrenceDays: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
                <button type="button" className="btn-secondary" onClick={() => setShowTestEditor((v) => !v)}>
                  {showTestEditor ? "Ascunde editorul de test" : "Test personalizat (opțional)"}
                </button>
                {showTestEditor ? (
                  <TrainingTestQuestionsEditor
                    value={typeForm.testQuestions ?? []}
                    onChange={(testQuestions) => setTypeForm((p) => ({ ...p, testQuestions }))}
                  />
                ) : null}
                <div className="comms-compose-actions">
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={createType.isPending || updateType.isPending}
                  >
                    {editingTypeId
                      ? updateType.isPending
                        ? "Se salvează…"
                        : "Salvează tip"
                      : createType.isPending
                        ? "Se creează…"
                        : "Adaugă tip"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeTypeForm}>
                    Anulează
                  </button>
                </div>
              </form>
            </MasterDataCreateModal>
          ) : null}
        </>
      ) : null}

      {tab === "flow" ? (
        <div className="ssm-panel-layout">
          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <h4 className="card-title">Selectează instruirea</h4>
              {showCatalogForms ? (
                <button type="button" className="btn-secondary" onClick={() => setTab("plan")}>
                  Planifică instruire
                </button>
              ) : null}
            </div>
            {plansQuery.isLoading ? <p className="field-hint">Se încarcă instruirile…</p> : null}
            {plansQuery.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(plansQuery.error)}
              </p>
            ) : null}
            <div className="ssm-doc-items">
              {planOptions.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`ssm-doc-item ${activePlan?.id === plan.id ? "selected" : ""}`}
                  onClick={() => setActivePlanId(plan.id)}
                >
                  <strong>
                    {plan.employeeName} — {plan.trainingTypeName}
                  </strong>
                  <span>
                    {planWorkflowLabel(plan)} · {new Date(plan.dueAt).toLocaleDateString("ro-RO")}
                  </span>
                  <span className={planStatusClass(plan.status)}>{planStatusLabel(plan.status)}</span>
                </button>
              ))}
              {!plansQuery.isLoading && !planOptions.length ? (
                <div className="form-stack">
                  <p className="field-hint">
                    Nicio instruire disponibilă. Fluxul e-learning folosește planurile deja alocate.
                  </p>
                  {showCatalogForms ? (
                    <button type="button" className="btn-primary" onClick={() => setTab("plan")}>
                      Mergi la Planificare
                    </button>
                  ) : (
                    <p className="field-hint">Cere unui responsabil SSM să îți aloce o instruire.</p>
                  )}
                </div>
              ) : null}
            </div>
            <PaginationBar
              page={plansPaged.page}
              pageSize={plansPaged.pageSize}
              total={plansPaged.total}
              totalPages={plansPaged.totalPages}
              onPageChange={plansPage.setPage}
              onPageSizeChange={plansPage.setPageSize}
              disabled={plansQuery.isFetching}
            />
          </div>

          <div className="card form-stack ssm-doc-card">
            {!activePlan ? (
              showCatalogForms && !plansQuery.isLoading ? (
                <form className="form-stack" onSubmit={onCreatePlan}>
                  <h4 className="card-title">Planifică o instruire</h4>
                  <p className="field-hint">
                    Creează un plan, apoi poți parcurge materialul, testul și semnăturile aici.
                  </p>
                  <EmployeeSelect
                    id="flow-plan-employee"
                    label="Angajat"
                    value={planForm.employeeId}
                    required
                    onChange={(employeeId) => setPlanForm((p) => ({ ...p, employeeId }))}
                  />
                  <TrainingTypeSelect
                    id="flow-plan-type"
                    label="Tip instruire"
                    value={planForm.trainingTypeId}
                    valueField="id"
                    allowEmpty
                    emptyLabel="Selectează tip"
                    activeOnly={false}
                    onChange={(trainingTypeId) => setPlanForm((p) => ({ ...p, trainingTypeId }))}
                  />
                  <div className="field">
                    <label htmlFor="flow-plan-material-title">Titlu material</label>
                    <input
                      id="flow-plan-material-title"
                      value={planForm.materialTitle ?? ""}
                      onChange={(e) => setPlanForm((p) => ({ ...p, materialTitle: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="flow-plan-due">Scadență</label>
                    <input
                      id="flow-plan-due"
                      type="datetime-local"
                      value={planForm.dueAt.slice(0, 16)}
                      onChange={(e) =>
                        setPlanForm((p) => ({ ...p, dueAt: new Date(e.target.value).toISOString() }))
                      }
                    />
                  </div>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={createPlan.isPending || !planForm.trainingTypeId || !planForm.employeeId}
                  >
                    {createPlan.isPending ? "Se planifică…" : "Planifică și deschide fluxul"}
                  </button>
                  {createPlan.isError ? (
                    <p className="feedback error" role="alert">
                      {mutationErrorMessage(createPlan.error)}
                    </p>
                  ) : null}
                </form>
              ) : (
                <p className="field-hint">Selectează o instruire din listă.</p>
              )
            ) : (
              <>
                <h4 className="card-title">
                  {activePlan.trainingTypeName}
                  {activePlan.trainingTypeCategory
                    ? ` · ${trainingCategoryLabel(activePlan.trainingTypeCategory)}`
                    : ""}
                </h4>
                <p className="field-hint">
                  {activePlan.employeeName} · {planWorkflowLabel(activePlan)}
                </p>

                <TrainingMaterialViewer
                  plan={activePlan}
                  onOpened={() => {
                    if (!activePlan.materialStartedAt) {
                      startMaterial.mutate(activePlan.id);
                    }
                  }}
                />

                {showCatalogForms ? (
                  <div className="field">
                    <label htmlFor="upload-material">Încarcă material (PDF / Word / video)</label>
                    <input
                      id="upload-material"
                      type="file"
                      accept=".pdf,.doc,.docx,.mp4,.mov,.avi,.mkv,application/pdf,video/*"
                      disabled={uploadMaterial.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !activePlan.id) return;
                        uploadMaterial.mutate({ planId: activePlan.id, file });
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : null}

                <div className="ssm-inline-actions">
                  {planHasMaterial(activePlan) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={completeMaterial.isPending || Boolean(activePlan.materialCompletedAt)}
                      onClick={() => completeMaterial.mutate({ planId: activePlan.id })}
                    >
                      {activePlan.materialCompletedAt ? "Material parcurs" : "Confirmă material parcurs"}
                    </button>
                  ) : null}
                  {materialReady && activePlan.score == null && activePlan.status !== "BLOCKED" && testQuestions.length === 0 ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={startTest.isPending}
                      onClick={onStartElearning}
                    >
                      {startTest.isPending ? "Se pornește…" : "Pornește testul"}
                    </button>
                  ) : null}
                </div>

                {materialReady &&
                activePlan.score == null &&
                activePlan.status !== "BLOCKED" &&
                testQuestions.length > 0 ? (
                  <SsmTrainingTestPanel
                    questions={testQuestions}
                    disabled={completeTest.isPending}
                    isSubmitting={completeTest.isPending}
                    onSubmit={onCompleteTest}
                  />
                ) : null}

                {activePlan.score != null && activePlan.status !== "BLOCKED" ? (
                  <SsmTrainingTestPanel
                    questions={[]}
                    result={
                      testResult ?? {
                        score: activePlan.score,
                        passed: true,
                        correctCount: 0,
                        totalCount: 0
                      }
                    }
                    onSubmit={() => undefined}
                  />
                ) : null}

                <SignatureCanvas value={signature} onChange={setSignature} />
                <div className="ssm-inline-actions">
                  {canSignAsEmployee ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!signature.startsWith("data:image")}
                      onClick={() =>
                        signPlan.mutate({
                          planId: activePlan.id,
                          role: "EMPLOYEE",
                          signatureData: signature
                        })
                      }
                    >
                      Semnează angajat
                    </button>
                  ) : null}
                  {canApproveTraining && activePlan.trainingTypeCategory === "WORKPLACE" ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={
                        !signature.startsWith("data:image") ||
                        !activePlan.employeeSignedAt ||
                        Boolean(activePlan.managerSignedAt)
                      }
                      onClick={() =>
                        signPlan.mutate({
                          planId: activePlan.id,
                          role: "MANAGER",
                          signatureData: signature
                        })
                      }
                    >
                      Aprobă manager
                    </button>
                  ) : null}
                  {canApproveTraining ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!signature.startsWith("data:image")}
                        onClick={() =>
                          signPlan.mutate({
                            planId: activePlan.id,
                            role: "RESPONSIBLE",
                            signatureData: signature
                          })
                        }
                      >
                        Semnează SSM
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          !signature.startsWith("data:image") || !planOptions.length || signBatch.isPending
                        }
                        onClick={() =>
                          signBatch.mutate({
                            planIds: planOptions.map((p) => p.id),
                            role: "RESPONSIBLE",
                            signatureData: signature
                          })
                        }
                      >
                        Semnare în pachet
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setDownloadError(null);
                      void downloadWithAuth(
                        ssmApi.getIndividualSheetUrl(activePlan.id),
                        `fisa-instruire-individuala-anexa-11.pdf`
                      ).catch((err: unknown) => setDownloadError(mutationErrorMessage(err)));
                    }}
                  >
                    Descarcă Anexa 11 (fișa legală)
                  </button>
                </div>
                {downloadError ? <p className="feedback error">{downloadError}</p> : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === "dossier" ? (
        <div className="ssm-panel-layout ssm-panel-layout--single">
          <div className="card form-stack ssm-doc-card">
            <h4 className="card-title">Dosar digital angajat</h4>
            <EmployeeSelect
              id="digital-employee"
              label="Angajat"
              value={digitalEmployeeId}
              disabled={Boolean(session?.linkedEmployeeId)}
              onChange={setDigitalEmployeeId}
            />
            <div className="ssm-inline-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={!digitalEmployeeId.trim()}
                onClick={() => {
                  const id = digitalEmployeeId.trim();
                  if (!id) {
                    setDownloadError("Selectează un angajat.");
                    return;
                  }
                  setDownloadError(null);
                  void ssmApi
                    .employeeDigitalFile(id)
                    .then((data) => setDossierData(data))
                    .catch((err: unknown) => {
                      setDossierData(null);
                      setDownloadError(mutationErrorMessage(err));
                    });
                }}
              >
                Încarcă dosar
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!digitalEmployeeId.trim()}
                onClick={() => {
                  const id = digitalEmployeeId.trim();
                  if (!id) {
                    setDownloadError("Selectează un angajat.");
                    return;
                  }
                  setDownloadError(null);
                  void downloadWithAuth(ssmApi.getDigitalFileZipUrl(id), `dosar-${id}.zip`).catch(
                    (err: unknown) => setDownloadError(mutationErrorMessage(err))
                  );
                }}
              >
                Export ZIP
              </button>
            </div>
            {downloadError ? <p className="feedback error">{downloadError}</p> : null}
            {dossierData ? (
              <div className="ssm-history-list">
                <p className="field-hint">
                  {dossierData.trainings.length} instruiri · {dossierData.documents.length} documente
                  {dossierData.eipRecords?.length ? ` · ${dossierData.eipRecords.length} EIP` : ""}
                  {dossierData.medicalControls?.length ? ` · ${dossierData.medicalControls.length} controale medicale` : ""}
                </p>
                {dossierData.trainings.slice(0, 12).map((t) => (
                  <div key={t.id} className="ssm-history-item">
                    <div>
                      <strong>{t.type}</strong>
                      <div className="field-hint">{t.status}</div>
                    </div>
                    <span className="ssm-chip">{t.score != null ? `${t.score}%` : "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="field-hint">Selectează angajatul și încarcă dosarul.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
