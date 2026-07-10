import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateSsmPreventionPlanRequest, SsmPreventionPlanItem, SsmRiskTargetType } from "@repo/shared-types/ssm";
import { useDepartmentsLookup, useJobPositionsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import {
  useArchivePreventionPlan,
  useCreatePreventionMeasure,
  useCreatePreventionPlan,
  usePreventionPlans,
  useUpdatePreventionMeasure
} from "../hooks/useSsmPpp";

const TARGET_TYPE_OPTIONS = [
  { value: "JOB_POSITION", label: "Post de lucru" },
  { value: "WORKSITE", label: "Punct de lucru" },
  { value: "DEPARTMENT", label: "Departament" }
] as const;

const MEASURE_STATUS_LABELS = {
  OPEN: "Deschisă",
  COMPLETED: "Finalizată",
  OVERDUE: "Restantă"
} as const;

const EMPTY_PLAN: CreateSsmPreventionPlanRequest = {
  title: "",
  targetType: "JOB_POSITION",
  reviewDate: "",
  notes: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function planTargetLabel(plan: SsmPreventionPlanItem): string {
  if (plan.targetType === "JOB_POSITION") return plan.jobPositionName ?? "Post nespecificat";
  if (plan.targetType === "WORKSITE") return plan.worksiteName ?? "Punct nespecificat";
  return plan.departmentName ?? "Departament nespecificat";
}

function targetTypeLabel(type: SsmRiskTargetType): string {
  return TARGET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function formatRoDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString("ro-RO") : "—";
}

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
  const activePlans = items.filter((plan) => plan.status === "ACTIVE");
  const selectedPlan = items.find((plan) => plan.id === selectedPlanId);

  const targetRefOptions = useMemo(() => {
    if (planForm.targetType === "JOB_POSITION") {
      return mapToOptions(positions.data?.items ?? [], (job) => job.id, (job) => `${job.code} — ${job.name}`);
    }
    if (planForm.targetType === "WORKSITE") {
      return mapToOptions(worksites.data?.items ?? [], (worksite) => worksite.id, (worksite) => `${worksite.code} — ${worksite.name}`);
    }
    return mapToOptions(departments.data?.items ?? [], (department) => department.id, (department) => `${department.code} — ${department.name}`);
  }, [departments.data?.items, planForm.targetType, positions.data?.items, worksites.data?.items]);

  const targetRefValue =
    planForm.targetType === "JOB_POSITION"
      ? planForm.jobPositionId ?? ""
      : planForm.targetType === "WORKSITE"
        ? planForm.worksiteId ?? ""
        : planForm.departmentId ?? "";

  const onTargetRefChange = (value: string) => {
    setPlanForm((prev) => ({
      ...prev,
      jobPositionId: prev.targetType === "JOB_POSITION" ? value || undefined : undefined,
      worksiteId: prev.targetType === "WORKSITE" ? value || undefined : undefined,
      departmentId: prev.targetType === "DEPARTMENT" ? value || undefined : undefined
    }));
  };

  const closePlanModal = () => {
    setSelectedPlanId(null);
    setMeasureDescription("");
    setMeasureResponsible("");
    setMeasureDueDate("");
  };

  useEffect(() => {
    if (!selectedPlanId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePlanModal();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPlanId]);

  useEffect(() => {
    if (selectedPlanId && !activePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [activePlans, selectedPlanId]);

  const onCreatePlan = (event: FormEvent) => {
    event.preventDefault();
    createPlan.mutate(
      {
        ...planForm,
        title: planForm.title.trim(),
        reviewDate: planForm.reviewDate || undefined,
        notes: planForm.notes?.trim() || undefined
      },
      {
        onSuccess: (result) => {
          setPlanForm(EMPTY_PLAN);
          setSelectedPlanId(result.planId);
        }
      }
    );
  };

  const onAddMeasure = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlanId || !measureDescription.trim()) return;
    createMeasure.mutate(
      {
        planId: selectedPlanId,
        description: measureDescription.trim(),
        responsiblePerson: measureResponsible.trim() || undefined,
        dueDate: measureDueDate || undefined
      },
      {
        onSuccess: () => {
          setMeasureDescription("");
          setMeasureResponsible("");
          setMeasureDueDate("");
        }
      }
    );
  };

  const openMeasuresTotal = activePlans.reduce((sum, plan) => sum + plan.openMeasures, 0);

  return (
    <section className="ssm-ppp ssm-ppp--v2" aria-labelledby="ppp-workspace-title">
      <div className="ssm-ppp-stats" aria-label="Rezumat PPP">
        <div className="ssm-ppp-stat">
          <span>Planuri active</span>
          <strong>{activePlans.length}</strong>
        </div>
        <div className="ssm-ppp-stat">
          <span>Măsuri deschise</span>
          <strong>{openMeasuresTotal}</strong>
        </div>
        <div className="ssm-ppp-stat">
          <span>Plan selectat</span>
          <strong>{selectedPlan ? selectedPlan.openMeasures : "—"}</strong>
        </div>
      </div>

      <div className="ssm-ppp-workspace">
        <form className="ssm-ppp-panel ssm-ppp-create" onSubmit={onCreatePlan}>
          <header className="ssm-ppp-panel-head">
            <h3 id="ppp-workspace-title" className="ssm-ppp-panel-title">
              Plan PPP nou
            </h3>
            <p className="ssm-ppp-panel-lead">Completează detaliile și creează planul. Măsurile se adaugă după salvare.</p>
          </header>

          <div className="ssm-ppp-fields">
            <div className="field ssm-ppp-field ssm-ppp-field--full">
              <label htmlFor="ppp-title">Titlu plan</label>
              <input
                id="ppp-title"
                required
                value={planForm.title}
                placeholder="Ex. PPP depozit logistic — 2026"
                onChange={(event) => setPlanForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>

            <FieldSelect
              id="ppp-target-type"
              label="Tip țintă"
              className="ssm-ppp-field"
              value={planForm.targetType}
              onChange={(targetType) =>
                setPlanForm((prev) => ({
                  ...prev,
                  targetType: targetType as SsmRiskTargetType,
                  jobPositionId: undefined,
                  worksiteId: undefined,
                  departmentId: undefined
                }))
              }
              options={[...TARGET_TYPE_OPTIONS]}
            />

            <div className="field ssm-ppp-field">
              <label htmlFor="ppp-review-date">Data revizie</label>
              <input
                id="ppp-review-date"
                type="date"
                value={planForm.reviewDate ?? ""}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, reviewDate: event.target.value }))}
              />
            </div>

            <FieldSelect
              id="ppp-target-ref"
              label={targetTypeLabel(planForm.targetType)}
              className="ssm-ppp-field ssm-ppp-field--full"
              value={targetRefValue}
              onChange={onTargetRefChange}
              options={targetRefOptions}
              allowEmpty
              emptyLabel={`Selectează ${targetTypeLabel(planForm.targetType).toLowerCase()}`}
              hint={targetRefOptions.length === 0 ? "Nu există date master pentru ținta aleasă." : undefined}
            />

            <details className="ssm-ppp-notes-details ssm-ppp-field--full">
              <summary>Note opționale</summary>
              <div className="field ssm-ppp-field ssm-ppp-field--full">
                <label htmlFor="ppp-notes" className="visually-hidden">
                  Note
                </label>
                <textarea
                  id="ppp-notes"
                  rows={3}
                  value={planForm.notes ?? ""}
                  placeholder="Observații sau referințe interne"
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </details>
          </div>

          <footer className="ssm-ppp-panel-foot">
            <button type="submit" className="btn-primary" disabled={createPlan.isPending}>
              {createPlan.isPending ? "Se salvează…" : "Creează plan PPP"}
            </button>
            {createPlan.isError ? <p className="feedback error">{mutationErrorMessage(createPlan.error)}</p> : null}
          </footer>
        </form>

        <aside className="ssm-ppp-panel ssm-ppp-plans">
          <header className="ssm-ppp-panel-head ssm-ppp-panel-head--row">
            <div>
              <h3 className="ssm-ppp-panel-title">Planuri active</h3>
              <p className="ssm-ppp-panel-lead">Deschide un plan pentru a gestiona măsurile.</p>
            </div>
            <span className="ssm-chip">{activePlans.length}</span>
          </header>

          <div className="ssm-ppp-plan-list">
            {plansQuery.isLoading ? <p className="ssm-ppp-empty">Se încarcă planurile…</p> : null}
            {!plansQuery.isLoading && activePlans.length === 0 ? (
              <p className="ssm-ppp-empty">Nu există planuri active. Creează primul plan din formularul alăturat.</p>
            ) : null}
            {activePlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`ssm-ppp-plan-card${selectedPlanId === plan.id ? " is-selected" : ""}`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <div className="ssm-ppp-plan-card-top">
                  <strong>{plan.title}</strong>
                  {plan.reviewDate ? <span className="ssm-ppp-plan-date">Rev. {formatRoDate(plan.reviewDate)}</span> : null}
                </div>
                <p className="ssm-ppp-plan-meta">
                  {targetTypeLabel(plan.targetType)} · {planTargetLabel(plan)}
                </p>
                <div className="ssm-ppp-plan-stats">
                  <span className={`ssm-chip ${plan.openMeasures > 0 ? "warn" : "good"}`}>
                    {plan.openMeasures} deschise
                  </span>
                  <span className="ssm-chip">{plan.measureCount} total</span>
                  <span className="ssm-ppp-plan-open">Deschide detalii →</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {selectedPlan
        ? createPortal(
            <div className="ssm-ppp-modal-backdrop" role="presentation" onClick={closePlanModal}>
              <div
                className="ssm-ppp-panel ssm-ppp-detail ssm-ppp-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ppp-detail-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="ssm-ppp-detail-head">
                  <div>
                    <p className="ssm-ppp-detail-eyebrow">Plan selectat</p>
                    <h3 id="ppp-detail-title" className="ssm-ppp-detail-title">
                      {selectedPlan.title}
                    </h3>
                    <p className="ssm-ppp-detail-meta">
                      {targetTypeLabel(selectedPlan.targetType)} · {planTargetLabel(selectedPlan)}
                      {selectedPlan.reviewDate ? ` · revizie ${formatRoDate(selectedPlan.reviewDate)}` : ""}
                    </p>
                  </div>
                  <div className="ssm-ppp-detail-actions">
                    <button
                      type="button"
                      className="btn-secondary ssm-ppp-archive-btn"
                      onClick={() =>
                        archivePlan.mutate(selectedPlan.id, {
                          onSuccess: closePlanModal
                        })
                      }
                      disabled={archivePlan.isPending}
                    >
                      Arhivează plan
                    </button>
                    <button type="button" className="btn-secondary" onClick={closePlanModal}>
                      Închide
                    </button>
                  </div>
                </header>

                <form className="ssm-ppp-measure-add" onSubmit={onAddMeasure}>
                  <h4 className="ssm-ppp-subtitle">Adaugă măsură</h4>
                  <div className="ssm-ppp-fields ssm-ppp-fields--measure">
                    <div className="field ssm-ppp-field ssm-ppp-field--full">
                      <label htmlFor="ppp-measure-description">Descriere măsură</label>
                      <textarea
                        id="ppp-measure-description"
                        required
                        rows={2}
                        value={measureDescription}
                        placeholder="Ex. Montarea balustradelor de protecție la acces depozit"
                        onChange={(event) => setMeasureDescription(event.target.value)}
                      />
                    </div>
                    <div className="ssm-ppp-field">
                      <label htmlFor="ppp-measure-responsible">Responsabil</label>
                      <input
                        id="ppp-measure-responsible"
                        value={measureResponsible}
                        placeholder="Nume responsabil"
                        onChange={(event) => setMeasureResponsible(event.target.value)}
                      />
                    </div>
                    <div className="field ssm-ppp-field">
                      <label htmlFor="ppp-measure-due">Termen</label>
                      <input
                        id="ppp-measure-due"
                        type="date"
                        value={measureDueDate}
                        onChange={(event) => setMeasureDueDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ssm-ppp-measure-add-actions">
                    <button type="submit" className="btn-primary" disabled={createMeasure.isPending || !measureDescription.trim()}>
                      {createMeasure.isPending ? "Se adaugă…" : "Adaugă măsură"}
                    </button>
                  </div>
                  {createMeasure.isError ? <p className="feedback error">{mutationErrorMessage(createMeasure.error)}</p> : null}
                </form>

                <div className="ssm-ppp-measures-section">
                  <h4 className="ssm-ppp-subtitle">
                    Măsuri înregistrate
                    <span className="ssm-chip">{selectedPlan.measures.length}</span>
                  </h4>
                  {selectedPlan.measures.length === 0 ? (
                    <p className="ssm-ppp-empty">Nu există măsuri în acest plan. Adaugă prima măsură mai sus.</p>
                  ) : (
                    <ul className="ssm-ppp-measure-list">
                      {selectedPlan.measures.map((measure) => (
                        <li key={measure.id} className={`ssm-ppp-measure-row status-${measure.status.toLowerCase()}`}>
                          <div className="ssm-ppp-measure-copy">
                            <strong>{measure.description}</strong>
                            <span>
                              {measure.responsiblePerson ?? "Fără responsabil"} ·{" "}
                              {measure.dueDate ? formatRoDate(measure.dueDate) : "Fără termen"}
                            </span>
                          </div>
                          <div className="ssm-ppp-measure-row-actions">
                            <span
                              className={`ssm-chip ${measure.status === "COMPLETED" ? "good" : measure.status === "OVERDUE" ? "bad" : "warn"}`}
                            >
                              {MEASURE_STATUS_LABELS[measure.status]}
                            </span>
                            {measure.status !== "COMPLETED" ? (
                              <button
                                type="button"
                                className="btn-secondary"
                                disabled={updateMeasure.isPending}
                                onClick={() => updateMeasure.mutate({ measureId: measure.id, payload: { status: "COMPLETED" } })}
                              >
                                Finalizează
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
