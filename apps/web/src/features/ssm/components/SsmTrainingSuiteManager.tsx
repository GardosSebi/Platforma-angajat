import { FormEvent, useEffect, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CreateSsmTrainingPlanRequest,
  CreateSsmTrainingTypeRequest,
  SsmTrainingCategory,
  SsmTrainingPlanItem
} from "@repo/shared-types/ssm";
import type { SsmTrainingTestQuestionPublic } from "@repo/shared-types/ssm-training-test";
import {
  SSM_TRAINING_CATEGORY_META,
  trainingCategoryLabel,
  trainingCategoryMeta
} from "@repo/shared-types/ssm-training-catalog";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import {
  useCompleteTest,
  useCreateTrainingPlan,
  useCreateTrainingType,
  useDispatchTrainingReminders,
  useMaterialComplete,
  useSignPlan,
  useSignPlansBatch,
  useStartTest,
  useTrainingCalendar,
  useTrainingCompliance,
  useTrainingPlans,
  useTrainingReminders,
  useTrainingTypes
} from "../hooks/useSsmTrainingSuite";
import { ssmApi } from "../api/ssm.api";
import { SsmTrainingTestPanel } from "./SsmTrainingTestPanel";
import { planHasMaterial, planWorkflowLabel } from "../../employee-portal/utils";

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

const TRAINING_CATEGORIES: SsmTrainingCategory[] = [
  "INTRODUCTORY_GENERAL",
  "WORKPLACE",
  "PERIODIC",
  "SUPPLEMENTARY",
  "EMERGENCY_PSI"
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

  const plansPage = usePagination();
  const typesQuery = useTrainingTypes();
  const plansQuery = useTrainingPlans(plansPage.params);
  const plansPaged = paginationFromResult(plansQuery.data, plansPage.page, plansPage.pageSize);
  const calendarQuery = useTrainingCalendar();
  const remindersQuery = useTrainingReminders();
  const complianceQuery = useTrainingCompliance();

  const createType = useCreateTrainingType();
  const createPlan = useCreateTrainingPlan();
  const completeMaterial = useMaterialComplete();
  const startTest = useStartTest();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();
  const signBatch = useSignPlansBatch();
  const dispatchReminders = useDispatchTrainingReminders();

  const defaultTypeMeta = trainingCategoryMeta("PERIODIC");
  const [typeForm, setTypeForm] = useState<CreateSsmTrainingTypeRequest>({
    code: "GEN-SSM",
    name: "Instruire generală SSM",
    category: "PERIODIC",
    legalMinDurationHours: defaultTypeMeta?.defaultLegalHours,
    recurrenceDays: defaultTypeMeta?.defaultRecurrenceDays ?? 365,
    reminderDays: defaultTypeMeta?.defaultReminderDays ?? [30, 15, 7]
  });
  const [planForm, setPlanForm] = useState<CreateSsmTrainingPlanRequest>(defaultPlan());
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
  } | null>(null);

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
    const now = Date.now();
    return {
      upcoming: events.filter((e) => e.status === "PENDING" && new Date(e.dueAt).getTime() >= now),
      overdue: events.filter((e) => e.status === "OVERDUE"),
      inProgress: events.filter((e) => e.status === "PENDING"),
      completed: events.filter((e) => e.status === "COMPLETED").slice(0, 8)
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

  const onCreateType = (event: FormEvent) => {
    event.preventDefault();
    createType.mutate(typeForm, {
      onSuccess: (created) => {
        setPlanForm((prev) => ({ ...prev, trainingTypeId: created.id }));
      }
    });
  };

  const onCreatePlan = (event: FormEvent) => {
    event.preventDefault();
    createPlan.mutate(planForm);
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

  return (
    <section className="ssm-documents" aria-labelledby="training-suite-title">
      <div className="ssm-module-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea H · 3.3–3.4</p>
          <h2 id="training-suite-title" className="card-title">
            Modul instruire SSM / PSI
          </h2>
          <p className="ssm-hero-lead">
            Planificare, e-learning, teste, semnături olografe, fișe individuale și raport conformitate — conform fluxului
            legal de instruire.
          </p>
        </div>
        <div className="ssm-summary-strip">
          <div className="ssm-stat-card">
            <span>Conformitate</span>
            <strong>{compliance?.summary.compliantPercent ?? "-"}%</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Scadențe / remindere</span>
            <strong>{remindersQuery.data?.reminders.length ?? "-"}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Blocare admitere</span>
            <strong>{compliance?.summary.blockedAdmissionCount ?? "-"}</strong>
          </div>
        </div>
      </div>

      <div className="card ssm-doc-card ssm-training-legal-card">
        <h3 className="card-title">3.3.1 Tipuri de instruire gestionate</h3>
        <div className="ssm-training-legal-table" role="table" aria-label="Tipuri instruire SSM">
          <div className="ssm-training-legal-row head" role="row">
            <span role="columnheader">Tip instruire</span>
            <span role="columnheader">Când se efectuează</span>
            <span role="columnheader">Durată minimă legală</span>
            <span role="columnheader">În catalog</span>
          </div>
          {SSM_TRAINING_CATEGORY_META.map((meta) => {
            const catalogType = (typesQuery.data ?? []).find((t) => t.category === meta.category);
            return (
              <div key={meta.category} className="ssm-training-legal-row" role="row">
                <span role="cell">
                  <strong>{meta.labelRo}</strong>
                </span>
                <span role="cell">{meta.whenPerformed}</span>
                <span role="cell">{meta.legalMinDuration}</span>
                <span role="cell">{catalogType ? `${catalogType.code}` : "—"}</span>
              </div>
            );
          })}
        </div>
        <p className="field-hint">
          La angajare nouă se declanșează automat introductiv-generală, la locul de muncă și PSI. La schimbare post/loc se
          alocă instruire suplimentară.
        </p>
      </div>

      {showCatalogForms ? (
        <div className="ssm-doc-grid">
          <form className="card form-stack ssm-doc-card" onSubmit={onCreateType}>
            <h3 className="card-title">Catalog tipuri instruire</h3>
            <div className="field">
              <label htmlFor="training-code">Cod</label>
              <input
                id="training-code"
                value={typeForm.code}
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
            <div className="field">
              <label htmlFor="training-category">Categorie legală</label>
              <select
                id="training-category"
                value={typeForm.category ?? "PERIODIC"}
                onChange={(e) => onCategoryChange(e.target.value as SsmTrainingCategory)}
              >
                {TRAINING_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {trainingCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="training-legal-hours">Durată minimă legală (ore)</label>
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
                  setTypeForm((p) => ({ ...p, recurrenceDays: e.target.value ? Number(e.target.value) : undefined }))
                }
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createType.isPending}>
              {createType.isPending ? "Se creează..." : "Adaugă tip instruire"}
            </button>
          </form>

          <form className="card form-stack ssm-doc-card" onSubmit={onCreatePlan}>
            <h3 className="card-title">3.3.3 Planificare</h3>
            <div className="field">
              <EmployeeSelect
                id="plan-employee"
                label="Angajat"
                value={planForm.employeeId}
                required
                onChange={(employeeId) => setPlanForm((p) => ({ ...p, employeeId }))}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-type">Tip instruire</label>
              <select
                id="plan-type"
                value={planForm.trainingTypeId}
                onChange={(e) => setPlanForm((p) => ({ ...p, trainingTypeId: e.target.value }))}
              >
                <option value="">Selectează tip</option>
                {(typesQuery.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} — {type.name} ({trainingCategoryLabel(type.category)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="plan-material-title">Titlu material (PDF / video)</label>
              <input
                id="plan-material-title"
                value={planForm.materialTitle ?? ""}
                onChange={(e) => setPlanForm((p) => ({ ...p, materialTitle: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-material-url">URL material</label>
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
            <button className="btn-primary" type="submit" disabled={createPlan.isPending || !planForm.trainingTypeId || !planForm.employeeId}>
              {createPlan.isPending ? "Se planifică..." : "Planifică instruire"}
            </button>
            <p className="field-hint">Notificare email la alocare; remindere 30/15/7 zile (configurabile per tip).</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => dispatchReminders.mutate()}
              disabled={dispatchReminders.isPending}
            >
              {dispatchReminders.isPending ? "Se trimit..." : "Trimite remindere (email)"}
            </button>
          </form>
        </div>
      ) : (
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          Planificarea și catalogul sunt disponibile pentru administrator SSM / responsabil entitate.
        </p>
      )}

      <div className="ssm-doc-grid second">
        <div className="card ssm-doc-card">
          <h3 className="card-title">Calendar instruiri</h3>
          <p className="field-hint">Scadențe viitoare, expirate și finalizate.</p>
          <div className="ssm-calendar-groups">
            <div>
              <h4 className="ssm-subtitle">Expirate / restante ({calendarBuckets.overdue.length})</h4>
              <ul className="ssm-calendar-list">
                {calendarBuckets.overdue.map((e) => (
                  <li key={e.id}>
                    <strong>{e.title}</strong>
                    <span className="ssm-chip bad">Scadență {new Date(e.dueAt).toLocaleDateString("ro-RO")}</span>
                  </li>
                ))}
                {!calendarBuckets.overdue.length ? <li className="field-hint">Nicio instruire expirată.</li> : null}
              </ul>
            </div>
            <div>
              <h4 className="ssm-subtitle">În curs ({calendarBuckets.inProgress.length})</h4>
              <ul className="ssm-calendar-list">
                {calendarBuckets.inProgress.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <button type="button" className="ssm-link-btn" onClick={() => setActivePlanId(e.id)}>
                      {e.trainingTypeName} — {e.employeeName}
                    </button>
                    <span className="field-hint">până la {new Date(e.dueAt).toLocaleDateString("ro-RO")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h4 className="ssm-subtitle">Remindere active</h4>
          <ul className="ssm-calendar-list compact">
            {(remindersQuery.data?.reminders ?? []).slice(0, 8).map((r) => (
              <li key={r.trainingPlanId}>
                {r.employeeName}: {r.trainingTypeName} —{" "}
                {r.daysUntilDue < 0 ? `restantă ${Math.abs(r.daysUntilDue)} zile` : `în ${r.daysUntilDue} zile`}
              </li>
            ))}
          </ul>
        </div>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Evaluări planificate</h3>
          <div className="ssm-doc-items">
            {planOptions.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`ssm-doc-item ${activePlanId === plan.id ? "selected" : ""}`}
                onClick={() => setActivePlanId(plan.id)}
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
      </div>

      <div className="card ssm-doc-card ssm-training-elearning-card">
        <h3 className="card-title">3.3.2 Flux instruire online (e-learning)</h3>
        {activePlan ? (
          <>
            <ol className="ssm-training-flow-steps">
              <li className={activePlan.materialCompletedAt || !planHasMaterial(activePlan) ? "done" : ""}>Notificare și acces material</li>
              <li className={activePlan.materialCompletedAt || !planHasMaterial(activePlan) ? "done" : ""}>Parcurgere material (PDF / Word / video)</li>
              <li className={activePlan.score != null ? "done" : ""}>Test verificare cunoștințe</li>
              <li className={activePlan.score != null ? "done" : ""}>Înregistrare automată dată, scor, timp</li>
              <li>Generare fișă individuală</li>
              <li className={activePlan.employeeSignedAt ? "done" : ""}>Semnătură angajat</li>
              <li className={activePlan.responsibleSignedAt ? "done" : ""}>Semnătură responsabil SSM (pachet)</li>
              <li className={activePlan.responsibleSignedAt ? "done" : ""}>Arhivare în dosar digital</li>
            </ol>
            <p className="field-hint">
              <strong>{activePlan.trainingTypeName}</strong>
              {activePlan.trainingTypeCategory
                ? ` (${trainingCategoryLabel(activePlan.trainingTypeCategory)})`
                : ""}{" "}
              — {activePlan.employeeName} · {planWorkflowLabel(activePlan)}
            </p>
            {planHasMaterial(activePlan) ? (
              activePlan.materialUrl ? (
                <p>
                  <a href={activePlan.materialUrl} target="_blank" rel="noreferrer" className="btn-text-link">
                    Deschide material: {activePlan.materialTitle ?? "Instruire"}
                  </a>
                </p>
              ) : (
                <p className="field-hint">Nu este setat URL material — adaugă la planificare.</p>
              )
            ) : (
              <p className="field-hint">Fără material — testul poate fi pornit direct.</p>
            )}
            <div className="ssm-inline-actions">
              {planHasMaterial(activePlan) ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activePlan.id || completeMaterial.isPending || Boolean(activePlan.materialCompletedAt)}
                  onClick={() => activePlan.id && completeMaterial.mutate(activePlan.id)}
                >
                  {activePlan.materialCompletedAt ? "Material parcurs" : "Material parcurs"}
                </button>
              ) : null}
              {materialReady && activePlan.score == null && activePlan.status !== "BLOCKED" ? (
                testQuestions.length === 0 ? (
                  <button type="button" className="btn-secondary" disabled={startTest.isPending} onClick={onStartElearning}>
                    {startTest.isPending ? "Se pornește..." : "Pornește testul"}
                  </button>
                ) : null
              ) : null}
            </div>
            {materialReady && activePlan.score == null && activePlan.status !== "BLOCKED" && testQuestions.length > 0 ? (
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
                    activePlan.id &&
                    signPlan.mutate({ planId: activePlan.id, role: "EMPLOYEE", signatureData: signature })
                  }
                >
                  Semnează angajat
                </button>
              ) : null}
              {canApproveTraining ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!signature.startsWith("data:image")}
                    onClick={() =>
                      activePlan.id &&
                      signPlan.mutate({ planId: activePlan.id, role: "RESPONSIBLE", signatureData: signature })
                    }
                  >
                    Semnează responsabil SSM
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      !signature.startsWith("data:image") ||
                      !planOptions.length ||
                      signBatch.isPending
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
                  if (!activePlan.id) return;
                  setDownloadError(null);
                  void downloadWithAuth(
                    ssmApi.getIndividualSheetUrl(activePlan.id),
                    `fisa-instruire-${activePlan.id}.pdf`
                  ).catch((err: unknown) => setDownloadError(mutationErrorMessage(err)));
                }}
              >
                Descarcă fișă individuală (PDF)
              </button>
            </div>
            {downloadError ? <p className="feedback error">{downloadError}</p> : null}
          </>
        ) : (
          <p className="field-hint">Selectează un plan din listă pentru a parcurge fluxul e-learning.</p>
        )}
      </div>

      <div className="ssm-doc-grid second">
        <div className="card ssm-doc-card">
          <h3 className="card-title">Raport conformitate instruire</h3>
          <p className="field-hint">
            {compliance?.summary.employeeCount ?? 0} angajați · {compliance?.summary.compliantPercent ?? 0}% instruiți la
            zi
          </p>
          <div className="ssm-history-list">
            {(compliance?.byDepartment ?? []).map((dept) => (
              <div key={dept.departmentId ?? "none"} className="ssm-history-item">
                <div>
                  <strong>{dept.departmentName}</strong>
                  <div className="field-hint">
                    {dept.complianceScore}% conformitate · {dept.blockedCount} blocări admitere
                  </div>
                </div>
                <span className="ssm-chip">{dept.employeeCount} angajați</span>
              </div>
            ))}
          </div>
          <div className="ssm-history-list" style={{ marginTop: "1rem" }}>
            {(compliance?.items ?? []).slice(0, 8).map((item) => (
              <div key={item.employeeId} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    {item.complianceScore}% · restanțe {item.overdue}
                  </div>
                </div>
                <span className={item.blockedAdmission ? "badge-bad" : "badge-good"}>
                  {item.blockedAdmission ? "Blocare admitere" : "Admis"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Dosar digital angajat</h3>
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
              onClick={async () => {
                const data = await ssmApi.employeeDigitalFile(digitalEmployeeId);
                setDossierData(data);
              }}
            >
              Încarcă dosar (instruiri arhivate)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const id = digitalEmployeeId.trim();
                if (!id) return;
                void downloadWithAuth(ssmApi.getDigitalFileZipUrl(id), `dosar-${id}.zip`);
              }}
            >
              Export ZIP dosar
            </button>
          </div>
          {dossierData ? (
            <p className="field-hint">{dossierData.trainings.length} instruiri în dosarul digital.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
