import { FormEvent, useEffect, useMemo, useState } from "react";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type {
  CompleteSsmTestRequest,
  CreateSsmTrainingPlanRequest,
  CreateSsmTrainingTypeRequest,
  SsmTrainingCategory,
  SsmTrainingPlanItem
} from "@repo/shared-types/ssm";
import {
  SSM_TRAINING_CATEGORY_META,
  trainingCategoryLabel,
  trainingCategoryMeta
} from "@repo/shared-types/ssm-training-catalog";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
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

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

const TRAINING_CATEGORIES: SsmTrainingCategory[] = [
  "INTRODUCTORY_GENERAL",
  "WORKPLACE",
  "PERIODIC",
  "SUPPLEMENTARY",
  "EMERGENCY_PSI"
];

const defaultPlan = (trainingTypeId = ""): CreateSsmTrainingPlanRequest => ({
  employeeId: DEMO_EMPLOYEE_ID,
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
  const [testForm, setTestForm] = useState<CompleteSsmTestRequest>({
    trainingPlanId: "",
    score: 80,
    durationSeconds: 900,
    passed: true
  });
  const [signature, setSignature] = useState("Semnătură olografă");
  const [digitalEmployeeId, setDigitalEmployeeId] = useState(resolvedEmployeeId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<{
    trainings: Array<{ id: string; type: string; status: string; score?: number | null }>;
    documents: Array<{ id: string; title: string; type: string; fileName?: string }>;
  } | null>(null);

  const planOptions = plansPaged.items;
  const activePlan = planOptions.find((p) => p.id === activePlanId) ?? planOptions[0];
  const compliance = complianceQuery.data;

  useEffect(() => {
    setDigitalEmployeeId(resolvedEmployeeId);
    setPlanForm((prev) => ({ ...prev, employeeId: resolvedEmployeeId }));
  }, [resolvedEmployeeId]);

  useEffect(() => {
    if (!activePlanId && planOptions[0]?.id) {
      setActivePlanId(planOptions[0].id);
    }
  }, [activePlanId, planOptions]);

  useEffect(() => {
    if (activePlan?.id) {
      setTestForm((prev) => ({ ...prev, trainingPlanId: activePlan.id }));
    }
  }, [activePlan?.id]);

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
      onSuccess: () => setTestStartedAt(Date.now())
    });
  };

  const onCompleteTest = (event: FormEvent) => {
    event.preventDefault();
    const durationSeconds = testStartedAt
      ? Math.max(60, Math.round((Date.now() - testStartedAt) / 1000))
      : testForm.durationSeconds;
    completeTest.mutate({ ...testForm, durationSeconds });
  };

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
              <label htmlFor="plan-employee">Angajat (ID)</label>
              <input
                id="plan-employee"
                value={planForm.employeeId}
                onChange={(e) => setPlanForm((p) => ({ ...p, employeeId: e.target.value }))}
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
            <button className="btn-primary" type="submit" disabled={createPlan.isPending || !planForm.trainingTypeId}>
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
              <li className={activePlan.materialCompletedAt ? "done" : ""}>Notificare și acces material</li>
              <li className={activePlan.materialCompletedAt ? "done" : ""}>Parcurgere material (PDF / Word / video)</li>
              <li>Test verificare cunoștințe</li>
              <li>Înregistrare automată dată, scor, timp</li>
              <li>Generare fișă individuală</li>
              <li>Semnătură angajat</li>
              <li>Semnătură responsabil SSM (pachet)</li>
              <li>Arhivare în dosar digital</li>
            </ol>
            <p className="field-hint">
              <strong>{activePlan.trainingTypeName}</strong>
              {activePlan.trainingTypeCategory
                ? ` (${trainingCategoryLabel(activePlan.trainingTypeCategory)})`
                : ""}{" "}
              — {activePlan.employeeName}
            </p>
            {activePlan.materialUrl ? (
              <p>
                <a href={activePlan.materialUrl} target="_blank" rel="noreferrer" className="btn-text-link">
                  Deschide material: {activePlan.materialTitle ?? "Instruire"}
                </a>
              </p>
            ) : (
              <p className="field-hint">Nu este setat URL material — adaugă la planificare.</p>
            )}
            <div className="ssm-inline-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={!activePlan.id || completeMaterial.isPending}
                onClick={() => activePlan.id && completeMaterial.mutate(activePlan.id)}
              >
                Material parcurs
              </button>
              <button type="button" className="btn-secondary" disabled={startTest.isPending} onClick={onStartElearning}>
                {startTest.isPending ? "Se pornește..." : "Pornește testul"}
              </button>
            </div>
            <form className="form-stack ssm-risk-version-form" onSubmit={onCompleteTest}>
              <div className="ssm-form-grid">
                <div className="field">
                  <label htmlFor="test-score">Scor test (%)</label>
                  <input
                    id="test-score"
                    type="number"
                    min={0}
                    max={100}
                    value={testForm.score}
                    onChange={(e) => setTestForm((p) => ({ ...p, score: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="field inline-check">
                  <input
                    id="test-pass"
                    type="checkbox"
                    checked={testForm.passed}
                    onChange={(e) => setTestForm((p) => ({ ...p, passed: e.target.checked }))}
                  />
                  <label htmlFor="test-pass">Test trecut</label>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={completeTest.isPending || !testForm.trainingPlanId}>
                {completeTest.isPending ? "Se salvează..." : "Finalizează test (înregistrare automată)"}
              </button>
            </form>
            <div className="field">
              <label htmlFor="signature-data">Semnătură olografă</label>
              <input id="signature-data" value={signature} onChange={(e) => setSignature(e.target.value)} />
            </div>
            <div className="ssm-inline-actions">
              {canSignAsEmployee ? (
                <button
                  type="button"
                  className="btn-secondary"
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
                    onClick={() =>
                      signBatch.mutate({
                        planIds: planOptions.map((p) => p.id),
                        role: "RESPONSIBLE",
                        signatureData: signature
                      })
                    }
                    disabled={!planOptions.length}
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
          <div className="field">
            <label htmlFor="digital-employee">Angajat (ID)</label>
            <input
              id="digital-employee"
              value={digitalEmployeeId}
              onChange={(e) => setDigitalEmployeeId(e.target.value)}
              readOnly={Boolean(session?.linkedEmployeeId)}
            />
          </div>
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
