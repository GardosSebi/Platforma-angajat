import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CompleteSsmTestRequest, SsmTrainingPlanItem } from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import {
  useCompleteTest,
  useMaterialComplete,
  useSignPlan,
  useStartTest,
  useTrainingPlans
} from "../../ssm/hooks/useSsmTrainingSuite";
import { ssmApi } from "../../ssm/api/ssm.api";
import {
  formatRoDate,
  formatRoDateTime,
  mutationErrorMessage,
  planCategoryLabel,
  planStatusClass,
  planStatusLabel
} from "../utils";

function trainingStep(plan: SsmTrainingPlanItem): number {
  if (plan.employeeSignedAt) return 5;
  if (plan.score != null) return 4;
  if (plan.materialCompletedAt) return 3;
  return plan.materialUrl ? 2 : 1;
}

export function EmployeeTrainingsPanel() {
  const plansQuery = useTrainingPlans({ page: 1, pageSize: 50 });
  const plans = plansQuery.data?.items ?? [];

  const [activePlanId, setActivePlanId] = useState("");
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);
  const [signature, setSignature] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [testForm, setTestForm] = useState<CompleteSsmTestRequest>({
    trainingPlanId: "",
    score: 80,
    durationSeconds: 900,
    passed: true
  });

  const completeMaterial = useMaterialComplete();
  const startTest = useStartTest();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? plans[0],
    [plans, activePlanId]
  );

  const pendingPlans = useMemo(
    () => plans.filter((p) => p.status === "PENDING" || p.status === "OVERDUE" || p.status === "BLOCKED"),
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
    if (!activePlan?.id) return;
    setTestForm((prev) => ({ ...prev, trainingPlanId: activePlan.id }));
  }, [activePlan?.id]);

  const onStartTest = () => {
    if (!activePlan?.id) return;
    setTestStartedAt(Date.now());
    startTest.mutate(activePlan.id, {
      onSuccess: () => setTestForm((prev) => ({ ...prev, trainingPlanId: activePlan.id }))
    });
  };

  const onCompleteTest = (event: FormEvent) => {
    event.preventDefault();
    const durationSeconds = testStartedAt
      ? Math.max(60, Math.round((Date.now() - testStartedAt) / 1000))
      : testForm.durationSeconds;
    completeTest.mutate({ ...testForm, durationSeconds });
  };

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
                    <span className={planStatusClass(plan.status)}>{planStatusLabel(plan.status)}</span>
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
                <span className={planStatusClass(activePlan.status)}>{planStatusLabel(activePlan.status)}</span>
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
                <li className={step >= 5 ? "done" : ""}>Așteaptă validarea responsabilului SSM</li>
              </ol>

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
                <p className="field-hint">Materialul va fi disponibil de la responsabilul SSM.</p>
              )}

              <div className="ssm-inline-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(activePlan.materialCompletedAt) || completeMaterial.isPending}
                  onClick={() => completeMaterial.mutate(activePlan.id)}
                >
                  {activePlan.materialCompletedAt ? "Material parcurs" : "Confirm parcurgerea materialului"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activePlan.materialCompletedAt || startTest.isPending}
                  onClick={onStartTest}
                >
                  {startTest.isPending ? "Se pornește testul…" : "Pornește testul"}
                </button>
              </div>

              {activePlan.materialCompletedAt ? (
                <form className="form-stack employee-test-form" onSubmit={onCompleteTest}>
                  <div className="ssm-form-grid">
                    <div className="field">
                      <label htmlFor="emp-test-score">Scor test (%)</label>
                      <input
                        id="emp-test-score"
                        type="number"
                        min={0}
                        max={100}
                        value={testForm.score}
                        onChange={(e) => setTestForm((p) => ({ ...p, score: Number(e.target.value || 0) }))}
                      />
                    </div>
                    <div className="field inline-check">
                      <input
                        id="emp-test-pass"
                        type="checkbox"
                        checked={testForm.passed}
                        onChange={(e) => setTestForm((p) => ({ ...p, passed: e.target.checked }))}
                      />
                      <label htmlFor="emp-test-pass">Am trecut testul</label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={completeTest.isPending || activePlan.score != null}
                  >
                    {activePlan.score != null
                      ? `Test înregistrat — scor ${activePlan.score}%`
                      : completeTest.isPending
                        ? "Se salvează…"
                        : "Finalizează testul"}
                  </button>
                </form>
              ) : null}

              {activePlan.score != null && !activePlan.employeeSignedAt ? (
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
                  {activePlan.responsibleSignedAt
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
              {(completeMaterial.isError || completeTest.isError || signPlan.isError) && (
                <p className="feedback error">
                  {mutationErrorMessage(
                    completeMaterial.error ?? completeTest.error ?? signPlan.error
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
