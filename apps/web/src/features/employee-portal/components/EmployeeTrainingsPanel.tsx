import { useEffect, useMemo, useState } from "react";
import type { SsmTrainingPlanItem } from "@repo/shared-types/ssm";
import type { SsmTrainingTestQuestionPublic } from "@repo/shared-types/ssm-training-test";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import {
  useCompleteTest,
  useMaterialComplete,
  useSignPlan,
  useStartMaterial,
  useStartTest,
  useTrainingPlans
} from "../../ssm/hooks/useSsmTrainingSuite";
import { ssmApi } from "../../ssm/api/ssm.api";
import { SsmTrainingTestPanel } from "../../ssm/components/SsmTrainingTestPanel";
import {
  formatRoDate,
  formatRoDateTime,
  mutationErrorMessage,
  planCategoryLabel,
  planHasMaterial,
  planWorkflowClass,
  planWorkflowLabel,
  trainingStep
} from "../utils";

export function EmployeeTrainingsPanel() {
  const plansQuery = useTrainingPlans({ page: 1, pageSize: 50 });
  const plans = plansQuery.data?.items ?? [];

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
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [materialElapsed, setMaterialElapsed] = useState(0);

  const completeMaterial = useMaterialComplete();
  const startMaterial = useStartMaterial();
  const startTest = useStartTest();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? plans[0],
    [plans, activePlanId]
  );

  const pendingPlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.status === "PENDING" ||
          p.status === "OVERDUE" ||
          p.status === "BLOCKED" ||
          (p.score != null && !p.responsibleSignedAt)
      ),
    [plans]
  );

  useEffect(() => {
    if (!plans.length) {
      setActivePlanId("");
      return;
    }
    if (!activePlanId || !plans.some((p) => p.id === activePlanId)) {
      setActivePlanId(pendingPlans[0]?.id ?? plans[0].id);
    }
  }, [plans, activePlanId, pendingPlans]);

  useEffect(() => {
    setTestQuestions([]);
    setTestResult(null);
    setTestStartedAt(null);
    setSignature("");
    setMaterialElapsed(0);
  }, [activePlan?.id]);

  useEffect(() => {
    if (!activePlan || !planHasMaterial(activePlan) || activePlan.materialCompletedAt) return;
    if (!activePlan.materialStartedAt) {
      startMaterial.mutate(activePlan.id);
    }
  }, [activePlan?.id, activePlan?.materialCompletedAt, activePlan?.materialStartedAt]);

  useEffect(() => {
    if (!activePlan?.materialStartedAt || activePlan.materialCompletedAt) return;
    const started = new Date(activePlan.materialStartedAt).getTime();
    const tick = () => setMaterialElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activePlan?.materialStartedAt, activePlan?.materialCompletedAt]);

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

  const onStartTest = () => {
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

  if (plansQuery.isLoading) {
    return <p className="field-hint">Se încarcă instruirile tale…</p>;
  }

  if (plansQuery.isError) {
    return <p className="feedback error">{mutationErrorMessage(plansQuery.error)}</p>;
  }

  if (!plans.length) {
    return (
      <div className="employee-portal-empty card">
        <p>Nu ai instruiri alocate momentan.</p>
        <p className="field-hint">Vei primi o notificare când responsabilul SSM îți atribuie o instruire.</p>
      </div>
    );
  }

  const step = activePlan ? trainingStep(activePlan) : 1;

  return (
    <div className="employee-portal-trainings">
      <div className="employee-portal-split">
        <aside className="card employee-portal-list-card">
          <h3 className="card-title">Instruirile mele</h3>
          <p className="field-hint">{pendingPlans.length} de parcurs · {plans.length} total</p>
          <ul className="employee-training-list">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  className={`employee-training-list-item ${activePlan?.id === plan.id ? "selected" : ""}`}
                  onClick={() => setActivePlanId(plan.id)}
                >
                  <strong>{plan.trainingTypeName}</strong>
                  <span>{planCategoryLabel(plan)}</span>
                  <span className="employee-training-list-meta">
                    <span className={planWorkflowClass(plan)}>{planWorkflowLabel(plan)}</span>
                    <span>până la {formatRoDate(plan.dueAt)}</span>
                  </span>
                  {plan.blockedAdmission ? <span className="employee-badge-warn">Blocare admitere</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="card employee-portal-detail-card">
          {activePlan ? (
            <>
              <header className="employee-portal-detail-header">
                <div>
                  <h3 className="card-title">{activePlan.trainingTypeName}</h3>
                  <p className="field-hint">
                    {planCategoryLabel(activePlan)} · scadență {formatRoDate(activePlan.dueAt)}
                  </p>
                </div>
                <span className={planWorkflowClass(activePlan)}>{planWorkflowLabel(activePlan)}</span>
              </header>

              {activePlan.blockedAdmission ? (
                <div className="feedback error employee-portal-alert" role="alert">
                  Instruirea nu este validată. Contactează responsabilul SSM înainte de a relua activitatea la locul de
                  muncă.
                </div>
              ) : null}

              <ol className="ssm-training-flow-steps employee-training-steps">
                <li className={step >= 1 ? "done" : ""}>Deschide materialul</li>
                <li className={step >= 2 ? "done" : ""}>Confirmă parcurgerea</li>
                <li className={step >= 3 ? "done" : ""}>Completează testul</li>
                <li className={step >= 4 ? "done" : ""}>Semnează fișa</li>
                <li className={step >= 5 ? "done" : ""}>
                  {activePlan.trainingTypeCategory === "WORKPLACE" ? "Aprobare manager" : "Așteaptă validarea SSM"}
                </li>
                <li className={step >= 6 ? "done" : ""}>Validare responsabil SSM</li>
              </ol>

              {planHasMaterial(activePlan) ? (
                <>
                  {activePlan.materialUrl ? (
                    <p>
                      <a
                        href={activePlan.materialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary employee-portal-material-link"
                      >
                        Deschide: {activePlan.materialTitle ?? "Material instruire"}
                      </a>
                    </p>
                  ) : (
                    <p className="field-hint">{activePlan.materialTitle ?? "Material instruire"} — fără link extern.</p>
                  )}
                  {!activePlan.materialCompletedAt ? (
                    <p className="field-hint">
                      Timp parcurgere înregistrat automat: {Math.floor(materialElapsed / 60)} min {materialElapsed % 60} sec
                    </p>
                  ) : activePlan.materialTimeSpentSeconds ? (
                    <p className="field-hint">
                      Material parcurs în {Math.ceil(activePlan.materialTimeSpentSeconds / 60)} minute.
                    </p>
                  ) : null}
                  <div className="ssm-inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={Boolean(activePlan.materialCompletedAt) || completeMaterial.isPending}
                      onClick={() =>
                        completeMaterial.mutate({
                          planId: activePlan.id,
                          durationSeconds: materialElapsed || activePlan.materialTimeSpentSeconds || undefined
                        })
                      }
                    >
                      {activePlan.materialCompletedAt ? "Material parcurs" : "Confirm parcurgerea materialului"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="field-hint">Nu există material de parcurs — poți trece direct la test.</p>
              )}

              {materialReady && activePlan.score == null && activePlan.status !== "BLOCKED" ? (
                <div className="employee-test-section">
                  {testQuestions.length === 0 ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={startTest.isPending}
                      onClick={onStartTest}
                    >
                      {startTest.isPending ? "Se pornește testul…" : "Pornește testul"}
                    </button>
                  ) : (
                    <SsmTrainingTestPanel
                      questions={testQuestions}
                      disabled={completeTest.isPending}
                      isSubmitting={completeTest.isPending}
                      onSubmit={onCompleteTest}
                    />
                  )}
                </div>
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

              {activePlan.score != null && activePlan.status !== "BLOCKED" && !activePlan.employeeSignedAt ? (
                <div className="employee-signature-block">
                  <p className="field-hint">Semnează olograf în chenarul de mai jos pentru a confirma instruirea.</p>
                  <SignatureCanvas value={signature} onChange={setSignature} />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!signature.startsWith("data:image") || signPlan.isPending}
                    onClick={() =>
                      signPlan.mutate({ planId: activePlan.id, role: "EMPLOYEE", signatureData: signature })
                    }
                  >
                    {signPlan.isPending ? "Se salvează semnătura…" : "Semnează fișa de instruire"}
                  </button>
                </div>
              ) : null}

              {activePlan.employeeSignedAt ? (
                <p className="feedback success" role="status">
                  Ai semnat la {formatRoDateTime(activePlan.employeeSignedAt)}.
                  {activePlan.trainingTypeCategory === "WORKPLACE" && !activePlan.managerSignedAt
                    ? " În așteptarea aprobării managerului departamentului."
                    : activePlan.responsibleSignedAt
                      ? " Instruirea este validată de responsabilul SSM."
                      : " În așteptarea semnăturii responsabilului SSM."}
                </p>
              ) : null}

              <div className="ssm-inline-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    setDownloadError(null);
                    void downloadWithAuth(
                      ssmApi.getIndividualSheetUrl(activePlan.id),
                      `fisa-instruire-${activePlan.id}.pdf`
                    ).catch((err: unknown) => setDownloadError(mutationErrorMessage(err)));
                  }}
                >
                  Descarcă fișa individuală (PDF)
                </button>
              </div>
              {downloadError ? <p className="feedback error">{downloadError}</p> : null}
              {(completeMaterial.isError || completeTest.isError || signPlan.isError || startTest.isError) && (
                <p className="feedback error">
                  {mutationErrorMessage(
                    completeMaterial.error ?? startTest.error ?? completeTest.error ?? signPlan.error
                  )}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
