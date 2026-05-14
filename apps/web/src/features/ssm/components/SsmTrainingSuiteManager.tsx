import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CompleteSsmTestRequest,
  CreateSsmTrainingPlanRequest,
  CreateSsmTrainingTypeRequest,
  SsmTrainingCategory
} from "@repo/shared-types/ssm";
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
  useTrainingCompliance,
  useTrainingPlans,
  useTrainingReminders,
  useTrainingTypes
} from "../hooks/useSsmTrainingSuite";
import { ssmApi } from "../api/ssm.api";

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

const DEFAULT_TYPE: CreateSsmTrainingTypeRequest = {
  code: "GEN-SSM",
  name: "Instruire generala SSM",
  category: "PERIODIC",
  legalMinDurationHours: 8,
  recurrenceDays: 365,
  reminderDays: [30, 15, 7]
};

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
  materialTitle: "Material introductiv",
  materialUrl: "https://intranet.local/ssm/material-intro"
});

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function SsmTrainingSuiteManager() {
  const session = useAuthSession();
  const resolvedEmployeeId = session?.linkedEmployeeId ?? DEMO_EMPLOYEE_ID;
  const showCatalogForms = hasPermission(session?.roles, "ssm:training:assign");
  const canApproveTraining = hasPermission(session?.roles, "ssm:training:approve");
  const canSignAsEmployee = hasPermission(session?.roles, "ssm:training:edit");

  const typesQuery = useTrainingTypes();
  const plansQuery = useTrainingPlans();
  const remindersQuery = useTrainingReminders();
  const complianceQuery = useTrainingCompliance();

  const createType = useCreateTrainingType();
  const createPlan = useCreateTrainingPlan();
  const completeMaterial = useMaterialComplete();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();
  const signBatch = useSignPlansBatch();
  const dispatchReminders = useDispatchTrainingReminders();

  const [typeForm, setTypeForm] = useState<CreateSsmTrainingTypeRequest>(DEFAULT_TYPE);
  const [planForm, setPlanForm] = useState<CreateSsmTrainingPlanRequest>(defaultPlan());

  useEffect(() => {
    setDigitalEmployeeId(resolvedEmployeeId);
    setPlanForm((prev) => ({ ...prev, employeeId: resolvedEmployeeId }));
  }, [resolvedEmployeeId]);
  const [testForm, setTestForm] = useState<CompleteSsmTestRequest>({
    trainingPlanId: "",
    score: 80,
    durationSeconds: 900,
    passed: true
  });
  const [signature, setSignature] = useState("Semnatura olografa - canvas MVP");
  const [digitalEmployeeId, setDigitalEmployeeId] = useState(resolvedEmployeeId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<{
    trainings: Array<{ id: string; type: string; status: string; score?: number | null }>;
    documents: Array<{ id: string; title: string; type: string; fileName?: string }>;
    riskExposureSheets?: Array<{ id: string; title: string; fileName?: string }>;
    eipDecisionCopies?: Array<{ id: string; title: string; fileName?: string }>;
    medicalControls?: Array<{ id: string; controlType: string; result?: string | null }>;
  } | null>(null);

  const planOptions = plansQuery.data?.items ?? [];
  const bestPlanId = useMemo(() => planOptions[0]?.id ?? "", [planOptions]);

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

  const onCompleteTest = (event: FormEvent) => {
    event.preventDefault();
    completeTest.mutate(testForm);
  };

  return (
    <section className="ssm-documents" aria-labelledby="training-suite-title">
      <h2 id="training-suite-title" className="card-title">
        Instruire + teste + fișe (3.3-3.4)
      </h2>

      {showCatalogForms ? (
        <div className="ssm-doc-grid">
          <form className="card form-stack ssm-doc-card" onSubmit={onCreateType}>
          <h3 className="card-title">Catalog instruiri + recurență</h3>
          <div className="field">
            <label htmlFor="training-code">Cod tip instruire</label>
            <input
              id="training-code"
              value={typeForm.code}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="training-name">Denumire</label>
            <input
              id="training-name"
              value={typeForm.name}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="training-rec">Recurență (zile)</label>
            <input
              id="training-rec"
              type="number"
              value={typeForm.recurrenceDays ?? 365}
              onChange={(event) =>
                setTypeForm((prev) => ({ ...prev, recurrenceDays: Number(event.target.value || 365) }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="training-category">Categorie legală</label>
            <select
              id="training-category"
              value={typeForm.category ?? "PERIODIC"}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, category: event.target.value as SsmTrainingCategory }))}
            >
              {TRAINING_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="training-legal-hours">Durată minimă legală (ore)</label>
            <input
              id="training-legal-hours"
              type="number"
              value={typeForm.legalMinDurationHours ?? 8}
              onChange={(event) =>
                setTypeForm((prev) => ({ ...prev, legalMinDurationHours: Number(event.target.value || 8) }))
              }
            />
          </div>
          <button className="btn-primary" type="submit" disabled={createType.isPending}>
            {createType.isPending ? "Se creează..." : "Adaugă tip instruire"}
          </button>
          {createType.isSuccess ? (
            <p className="feedback success" role="status">
              Tipul de instruire a fost adăugat.
            </p>
          ) : null}
          {createType.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(createType.error)}
            </p>
          ) : null}
          <p className="field-hint">Tipuri existente: {(typesQuery.data ?? []).map((t) => t.code).join(", ") || "-"}</p>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onCreatePlan}>
          <h3 className="card-title">Planificare + calendar + reminder</h3>
          <div className="field">
            <label htmlFor="plan-employee">Employee ID</label>
            <input
              id="plan-employee"
              value={planForm.employeeId}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, employeeId: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="plan-type">Tip instruire</label>
            <select
              id="plan-type"
              value={planForm.trainingTypeId}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, trainingTypeId: event.target.value }))}
            >
              <option value="">Selectează tip</option>
              {(typesQuery.data ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} - {type.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="plan-sched">Data planificată (ISO)</label>
            <input
              id="plan-sched"
              value={planForm.scheduledAt}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="plan-due">Scadență (ISO)</label>
            <input
              id="plan-due"
              value={planForm.dueAt}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, dueAt: event.target.value }))}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={createPlan.isPending || !planForm.trainingTypeId}>
            {createPlan.isPending ? "Se planifică..." : "Adaugă eveniment instruire"}
          </button>
          {createPlan.isSuccess ? (
            <p className="feedback success" role="status">
              Planul de instruire a fost adăugat.
            </p>
          ) : null}
          {createPlan.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(createPlan.error)}
            </p>
          ) : null}
          <p className="field-hint">
            Reminder 30/15/7 + restanțe: {(remindersQuery.data?.reminders.length ?? 0)} elemente.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dispatchReminders.mutate()}
            disabled={dispatchReminders.isPending}
          >
            {dispatchReminders.isPending ? "Se trimit..." : "Trimite remindere email"}
          </button>
          {dispatchReminders.isSuccess ? (
            <p className="feedback success" role="status">
              Remindere trimise: {dispatchReminders.data.sent}
            </p>
          ) : null}
          {dispatchReminders.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(dispatchReminders.error)}
            </p>
          ) : null}
        </form>
        </div>
      ) : (
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          Catalogul de tipuri de instruire și planificarea centralizată sunt disponibile pentru administrator SSM /
          responsabil pe entitate.
        </p>
      )}

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onCompleteTest}>
          <h3 className="card-title">E-learning + test final + semnare</h3>
          <div className="field">
            <label htmlFor="test-plan">Plan instruire</label>
            <select
              id="test-plan"
              value={testForm.trainingPlanId}
              onChange={(event) => setTestForm((prev) => ({ ...prev, trainingPlanId: event.target.value }))}
            >
              <option value="">Selectează plan</option>
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.employeeName} - {plan.trainingTypeName} ({plan.status})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="test-score">Scor</label>
            <input
              id="test-score"
              type="number"
              value={testForm.score}
              onChange={(event) => setTestForm((prev) => ({ ...prev, score: Number(event.target.value || 0) }))}
            />
          </div>
          <div className="field inline-check">
            <input
              id="test-pass"
              type="checkbox"
              checked={testForm.passed}
              onChange={(event) => setTestForm((prev) => ({ ...prev, passed: event.target.checked }))}
            />
            <label htmlFor="test-pass">Test trecut</label>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => testForm.trainingPlanId && completeMaterial.mutate(testForm.trainingPlanId)}
            disabled={!testForm.trainingPlanId}
          >
            Marchează material parcurs
          </button>
          <button type="submit" className="btn-primary" disabled={!testForm.trainingPlanId || completeTest.isPending}>
            {completeTest.isPending ? "Se salvează..." : "Salvează rezultat test"}
          </button>
          {completeMaterial.isSuccess ? (
            <p className="feedback success" role="status">
              Materialul a fost marcat ca parcurs.
            </p>
          ) : null}
          {completeMaterial.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(completeMaterial.error)}
            </p>
          ) : null}
          {completeTest.isSuccess ? (
            <p className="feedback success" role="status">
              Rezultatul testului a fost salvat.
            </p>
          ) : null}
          {completeTest.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(completeTest.error)}
            </p>
          ) : null}
          {signPlan.isSuccess ? (
            <p className="feedback success" role="status">
              Semnătura a fost salvată.
            </p>
          ) : null}
          {signPlan.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(signPlan.error)}
            </p>
          ) : null}
          {signBatch.isSuccess ? (
            <p className="feedback success" role="status">
              Semnare în pachet: {signBatch.data.signed}/{signBatch.data.requested}.
            </p>
          ) : null}
          {signBatch.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(signBatch.error)}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="signature-data">Semnătură olografă (MVP text/base64)</label>
            <input id="signature-data" value={signature} onChange={(event) => setSignature(event.target.value)} />
          </div>
          <div className="ssm-inline-actions">
            {canSignAsEmployee ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  testForm.trainingPlanId &&
                  signPlan.mutate({ planId: testForm.trainingPlanId, role: "EMPLOYEE", signatureData: signature })
                }
                disabled={!testForm.trainingPlanId}
              >
                Semnează angajat
              </button>
            ) : null}
            {canApproveTraining ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  testForm.trainingPlanId &&
                  signPlan.mutate({ planId: testForm.trainingPlanId, role: "RESPONSIBLE", signatureData: signature })
                }
                disabled={!testForm.trainingPlanId}
              >
                Semnează responsabil SSM
              </button>
            ) : null}
            {canApproveTraining ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  signBatch.mutate({
                    planIds: planOptions.map((plan) => plan.id),
                    role: "RESPONSIBLE",
                    signatureData: signature
                  })
                }
                disabled={!planOptions.length}
              >
                Semnează în pachet (toate)
              </button>
            ) : null}
          </div>
          {testForm.trainingPlanId ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const trainingPlanId = testForm.trainingPlanId;
                if (!trainingPlanId) return;
                setDownloadError(null);
                void downloadWithAuth(ssmApi.getIndividualSheetUrl(trainingPlanId), `training-sheet-${trainingPlanId}.pdf`).catch(
                  (error: unknown) => {
                    setDownloadError(mutationErrorMessage(error));
                  }
                );
              }}
            >
              Descarcă PDF fișă individuală
            </button>
          ) : null}
          {downloadError ? <p className="feedback error">{downloadError}</p> : null}
        </form>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Dosar digital + conformitate</h3>
          <div className="field">
            <label htmlFor="digital-employee">Employee ID dosar</label>
            <input
              id="digital-employee"
              value={digitalEmployeeId}
              onChange={(event) => setDigitalEmployeeId(event.target.value)}
              readOnly={Boolean(session?.linkedEmployeeId)}
              aria-readonly={Boolean(session?.linkedEmployeeId)}
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
              Încarcă dosar digital
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const employeeId = digitalEmployeeId.trim();
                if (!employeeId) return;
                setDownloadError(null);
                void downloadWithAuth(ssmApi.getDigitalFileZipUrl(employeeId), `dossier-${employeeId}.zip`).catch(
                  (error: unknown) => {
                    setDownloadError(mutationErrorMessage(error));
                  }
                );
              }}
            >
              Export ZIP (etapizat)
            </button>
          </div>

          <div className="ssm-history-list">
            {(complianceQuery.data?.items ?? []).slice(0, 5).map((item) => (
              <div key={item.employeeId} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    conformitate {item.complianceScore}% | restanțe {item.overdue}
                  </div>
                </div>
                <span className={item.blockedAdmission ? "badge-bad" : "badge-good"}>
                  {item.blockedAdmission ? "Blocare admitere la lucru" : "Admis"}
                </span>
              </div>
            ))}
          </div>

          {dossierData ? (
            <p className="field-hint">
              Dosar: {dossierData.trainings.length} instruiri, {dossierData.documents.length} documente asociate,{" "}
              {dossierData.medicalControls?.length ?? 0} controale medicina muncii,{" "}
              {dossierData.riskExposureSheets?.length ?? 0} fișe expunere riscuri,{" "}
              {dossierData.eipDecisionCopies?.length ?? 0} decizii EIP.
            </p>
          ) : null}
          <p className="field-hint">Planuri active: {planOptions.length}. Plan implicit recomandat: {bestPlanId || "-"}</p>
          {downloadError ? <p className="feedback error">{downloadError}</p> : null}
        </div>
      </div>
    </section>
  );
}
