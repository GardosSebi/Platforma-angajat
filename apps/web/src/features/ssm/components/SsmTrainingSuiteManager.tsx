import { FormEvent, useMemo, useState } from "react";
import type { CompleteSsmTestRequest, CreateSsmTrainingPlanRequest, CreateSsmTrainingTypeRequest } from "@repo/shared-types/ssm";
import { getApiBaseUrl } from "../../../shared/api/api-base";
import {
  useCompleteTest,
  useCreateTrainingPlan,
  useCreateTrainingType,
  useMaterialComplete,
  useSignPlan,
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
  recurrenceDays: 365,
  reminderDays: [30, 15, 7]
};

const defaultPlan = (trainingTypeId = ""): CreateSsmTrainingPlanRequest => ({
  employeeId: DEMO_EMPLOYEE_ID,
  trainingTypeId,
  scheduledAt: new Date().toISOString(),
  dueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  materialTitle: "Material introductiv",
  materialUrl: "https://intranet.local/ssm/material-intro"
});

export function SsmTrainingSuiteManager() {
  const typesQuery = useTrainingTypes();
  const plansQuery = useTrainingPlans();
  const remindersQuery = useTrainingReminders();
  const complianceQuery = useTrainingCompliance();

  const createType = useCreateTrainingType();
  const createPlan = useCreateTrainingPlan();
  const completeMaterial = useMaterialComplete();
  const completeTest = useCompleteTest();
  const signPlan = useSignPlan();

  const [typeForm, setTypeForm] = useState<CreateSsmTrainingTypeRequest>(DEFAULT_TYPE);
  const [planForm, setPlanForm] = useState<CreateSsmTrainingPlanRequest>(defaultPlan());
  const [testForm, setTestForm] = useState<CompleteSsmTestRequest>({
    trainingPlanId: "",
    score: 80,
    durationSeconds: 900,
    passed: true
  });
  const [signature, setSignature] = useState("Semnatura olografa - canvas MVP");
  const [digitalEmployeeId, setDigitalEmployeeId] = useState(DEMO_EMPLOYEE_ID);
  const [dossierData, setDossierData] = useState<{
    trainings: Array<{ id: string; type: string; status: string; score?: number | null }>;
    documents: Array<{ id: string; title: string; type: string; fileName?: string }>;
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
          <button className="btn-primary" type="submit" disabled={createType.isPending}>
            {createType.isPending ? "Se creează..." : "Adaugă tip instruire"}
          </button>
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
          <p className="field-hint">
            Reminder 30/15/7 + restanțe: {(remindersQuery.data?.reminders.length ?? 0)} elemente.
          </p>
        </form>
      </div>

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
          <div className="field">
            <label htmlFor="signature-data">Semnătură olografă (MVP text/base64)</label>
            <input id="signature-data" value={signature} onChange={(event) => setSignature(event.target.value)} />
          </div>
          <div className="ssm-inline-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                testForm.trainingPlanId && signPlan.mutate({ planId: testForm.trainingPlanId, role: "EMPLOYEE", signatureData: signature })
              }
              disabled={!testForm.trainingPlanId}
            >
              Semnează angajat
            </button>
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
          </div>
          {testForm.trainingPlanId ? (
            <a
              className="btn-text-link"
              href={`${getApiBaseUrl()}${ssmApi.getIndividualSheetUrl(testForm.trainingPlanId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Descarcă PDF fișă individuală
            </a>
          ) : null}
        </form>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Dosar digital + conformitate</h3>
          <div className="field">
            <label htmlFor="digital-employee">Employee ID dosar</label>
            <input
              id="digital-employee"
              value={digitalEmployeeId}
              onChange={(event) => setDigitalEmployeeId(event.target.value)}
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
            <a
              className="btn-text-link"
              href={`${getApiBaseUrl()}${ssmApi.getDigitalFileZipUrl(digitalEmployeeId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Export ZIP (etapizat)
            </a>
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
              Dosar: {dossierData.trainings.length} instruiri, {dossierData.documents.length} documente asociate.
            </p>
          ) : null}
          <p className="field-hint">Planuri active: {planOptions.length}. Plan implicit recomandat: {bestPlanId || "-"}</p>
        </div>
      </div>
    </section>
  );
}
