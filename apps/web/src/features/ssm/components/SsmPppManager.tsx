import { FormEvent, useEffect, useState } from "react";
import type { CreateSsmPreventionPlanRequest, SsmPreventionPlanItem, SsmRiskTargetType } from "@repo/shared-types/ssm";
import { useDepartmentsLookup, useJobPositionsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions, stringOptions } from "../../../shared/components/field-select-options";
import {
  useArchivePreventionPlan,
  useCreatePreventionMeasure,
  useCreatePreventionPlan,
  usePreventionPlans,
  useUpdatePreventionMeasure
} from "../hooks/useSsmPpp";

const TARGET_TYPES: SsmRiskTargetType[] = ["JOB_POSITION", "WORKSITE", "DEPARTMENT"];

const EMPTY_PLAN: CreateSsmPreventionPlanRequest = {
  title: "",
  targetType: "JOB_POSITION",
  reviewDate: "",
  notes: ""
};

export function SsmPppManager() {
  const plansQuery = usePreventionPlans();
  const worksites = useWorksitesLookup();
  const departments = useDepartmentsLookup();
  const positions = useJobPositionsLookup();
  const createPlan = useCreatePreventionPlan();
  const archivePlan = useArchivePreventionPlan();
  const createMeasure = useCreatePreventionMeasure();
  const updateMeasure = useUpdatePreventionMeasure();

  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [measureDescription, setMeasureDescription] = useState("");
  const [measureResponsible, setMeasureResponsible] = useState("");
  const [measureDueDate, setMeasureDueDate] = useState("");

  const items = plansQuery.data?.items ?? [];
  const selectedPlan: SsmPreventionPlanItem | undefined = items.find((p) => p.id === selectedPlanId);

  useEffect(() => {
    if (!selectedPlanId && items.length) setSelectedPlanId(items[0].id);
  }, [items, selectedPlanId]);

  const onCreatePlan = (event: FormEvent) => {
    event.preventDefault();
    createPlan.mutate({
      ...planForm,
      title: planForm.title.trim(),
      reviewDate: planForm.reviewDate || undefined,
      notes: planForm.notes?.trim() || undefined
    });
  };

  const onAddMeasure = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlanId || !measureDescription.trim()) return;
    createMeasure.mutate({
      planId: selectedPlanId,
      description: measureDescription.trim(),
      responsiblePerson: measureResponsible.trim() || undefined,
      dueDate: measureDueDate || undefined
    }, {
      onSuccess: () => {
        setMeasureDescription("");
        setMeasureResponsible("");
        setMeasureDueDate("");
      }
    });
  };

  return (
    <section className="ssm-documents" aria-labelledby="ppp-title">
      <div className="ssm-module-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea H · 3.8 PPP</p>
          <h2 id="ppp-title" className="card-title">Plan prevenire și protecție (PPP)</h2>
          <p className="ssm-hero-lead">
            Gestionează planurile PPP cu măsuri, responsabili și termene — distinct de evaluările de risc și documentele PPP.
          </p>
        </div>
      </div>

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreatePlan}>
          <h3 className="card-title">Plan PPP nou</h3>
          <label>
            Titlu plan
            <input required value={planForm.title} onChange={(e) => setPlanForm((p) => ({ ...p, title: e.target.value }))} />
          </label>
          <FieldSelect
            id="ppp-target-type"
            label="Țintă"
            value={planForm.targetType}
            onChange={(targetType) => setPlanForm((p) => ({ ...p, targetType: targetType as SsmRiskTargetType }))}
            options={stringOptions(TARGET_TYPES)}
          />
          {planForm.targetType === "JOB_POSITION" ? (
            <FieldSelect
              id="ppp-job-position"
              label="Post"
              value={planForm.jobPositionId ?? ""}
              onChange={(jobPositionId) => setPlanForm((p) => ({ ...p, jobPositionId: jobPositionId || undefined }))}
              options={mapToOptions(positions.data?.items ?? [], (j) => j.id, (j) => `${j.code} — ${j.name}`)}
              allowEmpty
              emptyLabel="Selectează postul"
            />
          ) : null}
          {planForm.targetType === "WORKSITE" ? (
            <FieldSelect
              id="ppp-worksite"
              label="Punct de lucru"
              value={planForm.worksiteId ?? ""}
              onChange={(worksiteId) => setPlanForm((p) => ({ ...p, worksiteId: worksiteId || undefined }))}
              options={mapToOptions(worksites.data?.items ?? [], (w) => w.id, (w) => `${w.code} — ${w.name}`)}
              allowEmpty
              emptyLabel="Selectează punctul"
            />
          ) : null}
          {planForm.targetType === "DEPARTMENT" ? (
            <FieldSelect
              id="ppp-department"
              label="Departament"
              value={planForm.departmentId ?? ""}
              onChange={(departmentId) => setPlanForm((p) => ({ ...p, departmentId: departmentId || undefined }))}
              options={mapToOptions(departments.data?.items ?? [], (d) => d.id, (d) => `${d.code} — ${d.name}`)}
              allowEmpty
              emptyLabel="Selectează departamentul"
            />
          ) : null}
          <label>
            Data revizie
            <input type="date" value={planForm.reviewDate ?? ""} onChange={(e) => setPlanForm((p) => ({ ...p, reviewDate: e.target.value }))} />
          </label>
          <button type="submit" className="btn-primary" disabled={createPlan.isPending}>
            {createPlan.isPending ? "Se salvează…" : "Creează plan PPP"}
          </button>
        </form>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Planuri active</h3>
          <div className="ssm-doc-items">
            {items.filter((p) => p.status === "ACTIVE").map((plan) => (
              <article key={plan.id} className="ssm-doc-item">
                <button type="button" className="data-list-row" onClick={() => setSelectedPlanId(plan.id)}>
                  <strong>{plan.title}</strong>
                  <span>
                    {plan.targetType} · {plan.openMeasures} măsuri deschise / {plan.measureCount} total
                  </span>
                </button>
              </article>
            ))}
          </div>
        </div>

        {selectedPlan ? (
          <form className="card form-stack ssm-doc-card span-2" onSubmit={onAddMeasure}>
            <div className="ssm-card-header">
              <h3 className="card-title">Măsuri — {selectedPlan.title}</h3>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => archivePlan.mutate(selectedPlan.id)}
                disabled={archivePlan.isPending}
              >
                Arhivează plan
              </button>
            </div>
            <label>
              Descriere măsură
              <textarea required value={measureDescription} onChange={(e) => setMeasureDescription(e.target.value)} rows={2} />
            </label>
            <label>
              Responsabil
              <input value={measureResponsible} onChange={(e) => setMeasureResponsible(e.target.value)} />
            </label>
            <label>
              Termen
              <input type="date" value={measureDueDate} onChange={(e) => setMeasureDueDate(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={createMeasure.isPending}>
              Adaugă măsură
            </button>
            <div className="ssm-doc-items">
              {selectedPlan.measures.map((measure) => (
                <article key={measure.id} className="ssm-doc-item">
                  <strong>{measure.description}</strong>
                  <span>
                    {measure.responsiblePerson ?? "—"} · {measure.dueDate ? new Date(measure.dueDate).toLocaleDateString("ro-RO") : "fără termen"} · {measure.status}
                  </span>
                  {measure.status !== "COMPLETED" ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => updateMeasure.mutate({ measureId: measure.id, payload: { status: "COMPLETED" } })}
                    >
                      Marchează finalizată
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
