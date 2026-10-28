import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { CreateSsmPreventionPlanRequest, SsmPreventionPlanItem, SsmRiskTargetType } from "@repo/shared-types/ssm";
import { useDepartmentsLookup, useJobPositionsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { MasterDataCreateModal } from "../../master-data/components/MasterDataCreateModal";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import {
  useAddPreventionPlanVersion,
  useArchivePreventionPlan,
  useCreatePreventionMeasure,
  useCreatePreventionPlan,
  usePreventionPlanHistory,
  usePreventionPlans,
  useUpdatePreventionMeasure
} from "../hooks/useSsmPpp";
import { useRiskAssessments } from "../hooks/useSsmRisk";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";

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
  notes: "",
  riskAssessmentId: undefined
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

function planDetailMeta(plan: SsmPreventionPlanItem): string {
  return [
    `${targetTypeLabel(plan.targetType)} · ${planTargetLabel(plan)}`,
    plan.activeVersionNumber ? `v${plan.activeVersionNumber}` : "",
    plan.reviewDate ? `revizie ${formatRoDate(plan.reviewDate)}` : "",
    plan.riskAssessmentTitle ? `evaluare: ${plan.riskAssessmentTitle}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SsmPppManager() {
  const session = useAuthSession();
  const canApprove = hasPermission(session?.roles, "ssm:risk:approve");
  const plansQuery = usePreventionPlans();
  const riskAssessmentsQuery = useRiskAssessments({ status: "ACTIVE" });
  const worksites = useWorksitesLookup();
  const departments = useDepartmentsLookup();
  const positions = useJobPositionsLookup();
  const createPlan = useCreatePreventionPlan();
  const archivePlan = useArchivePreventionPlan();
  const createMeasure = useCreatePreventionMeasure();
  const updateMeasure = useUpdatePreventionMeasure();
  const addVersion = useAddPreventionPlanVersion();

  const [createOpen, setCreateOpen] = useState(false);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [measureDescription, setMeasureDescription] = useState("");
  const [measureResponsible, setMeasureResponsible] = useState("");
  const [measureDueDate, setMeasureDueDate] = useState("");
  const [versionReason, setVersionReason] = useState("");
  const historyQuery = usePreventionPlanHistory(selectedPlanId);

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

  const openCreate = () => {
    createPlan.reset();
    setCreateOpen(true);
  };
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const openPlan = (planId: string) => {
    createMeasure.reset();
    addVersion.reset();
    archivePlan.reset();
    setSelectedPlanId(planId);
  };

  const closePlanModal = useCallback(() => {
    setSelectedPlanId(null);
    setMeasureDescription("");
    setMeasureResponsible("");
    setMeasureDueDate("");
    setVersionReason("");
  }, []);

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
          setCreateOpen(false);
          setPlanForm(EMPTY_PLAN);
          openPlan(result.planId);
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

  const onSaveVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlan || !versionReason.trim()) return;
    addVersion.mutate(
      {
        planId: selectedPlan.id,
        payload: {
          updateReason: versionReason.trim(),
          reviewDate: selectedPlan.reviewDate ?? undefined,
          notes: selectedPlan.notes ?? undefined,
          measures: selectedPlan.measures.map((measure) => ({
            description: measure.description,
            responsiblePerson: measure.responsiblePerson ?? undefined,
            dueDate: measure.dueDate ?? undefined,
            status: measure.status,
            notes: measure.notes ?? undefined
          }))
        }
      },
      {
        onSuccess: () => setVersionReason("")
      }
    );
  };

  const openMeasuresTotal = activePlans.reduce((sum, plan) => sum + plan.openMeasures, 0);

  return (
    <section className="ssm-ppp" aria-labelledby="ppp-plans-title">
      <div className="ssm-ppp-panel">
        <header className="ssm-ppp-panel-head ssm-ppp-panel-head--row">
          <div>
            <h3 id="ppp-plans-title" className="ssm-ppp-panel-title">
              Planuri active ({activePlans.length})
            </h3>
            <p className="ssm-ppp-panel-lead">
              {openMeasuresTotal === 1 ? "1 măsură deschisă" : `${openMeasuresTotal} măsuri deschise`}
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Plan nou
          </button>
        </header>

        <div className="ssm-ppp-plan-list">
          {plansQuery.isLoading ? <p className="ssm-ppp-empty">Se încarcă planurile…</p> : null}
          {!plansQuery.isLoading && activePlans.length === 0 ? (
            <p className="ssm-ppp-empty">Nu există planuri active. Adaugă primul plan.</p>
          ) : null}
          {activePlans.map((plan) => (
            <button key={plan.id} type="button" className="ssm-ppp-plan-card" onClick={() => openPlan(plan.id)}>
              <div className="ssm-ppp-plan-card-top">
                <strong>{plan.title}</strong>
                {plan.reviewDate ? <span className="ssm-ppp-plan-date">Rev. {formatRoDate(plan.reviewDate)}</span> : null}
              </div>
              <p className="ssm-ppp-plan-meta">
                {targetTypeLabel(plan.targetType)} · {planTargetLabel(plan)}
                {plan.activeVersionNumber ? ` · v${plan.activeVersionNumber}` : ""}
                {plan.riskAssessmentTitle ? ` · Eval: ${plan.riskAssessmentTitle}` : ""}
              </p>
              <div className="ssm-ppp-plan-stats">
                <span className={`ssm-chip ${plan.openMeasures > 0 ? "warn" : "good"}`}>
                  {plan.openMeasures} deschise
                </span>
                <span className="ssm-chip">{plan.measureCount} total</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {createOpen ? (
        <MasterDataCreateModal title="Plan PPP nou" titleId="ppp-create-modal-title" onClose={closeCreate}>
          <form className="form-stack" onSubmit={onCreatePlan}>
            <div className="field">
              <label htmlFor="ppp-title">Titlu plan</label>
              <input
                id="ppp-title"
                required
                value={planForm.title}
                placeholder="ex. PPP depozit logistic — 2026"
                onChange={(event) => setPlanForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="ssm-panel-fields-row">
              <FieldSelect
                id="ppp-target-type"
                label="Tip țintă"
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
              <div className="field">
                <label htmlFor="ppp-review-date">Data revizie</label>
                <input
                  id="ppp-review-date"
                  type="date"
                  value={planForm.reviewDate ?? ""}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, reviewDate: event.target.value }))}
                />
              </div>
            </div>
            <FieldSelect
              id="ppp-target-ref"
              label={targetTypeLabel(planForm.targetType)}
              value={targetRefValue}
              onChange={onTargetRefChange}
              options={targetRefOptions}
              allowEmpty
              emptyLabel={`Selectează ${targetTypeLabel(planForm.targetType).toLowerCase()}`}
              hint={targetRefOptions.length === 0 ? "Nu există date master pentru ținta aleasă." : undefined}
            />
            <FieldSelect
              id="ppp-risk-assessment"
              label="Evaluare risc legată (opțional)"
              value={planForm.riskAssessmentId ?? ""}
              onChange={(riskAssessmentId) =>
                setPlanForm((prev) => ({ ...prev, riskAssessmentId: riskAssessmentId || undefined }))
              }
              options={mapToOptions(
                riskAssessmentsQuery.data?.items ?? [],
                (item) => item.id,
                (item) => `${item.title} · risc ${item.riskLevel ?? "-"}`
              )}
              allowEmpty
              emptyLabel="Fără legătură la evaluare"
            />
            <div className="field">
              <label htmlFor="ppp-notes">Note (opțional)</label>
              <textarea
                id="ppp-notes"
                rows={2}
                value={planForm.notes ?? ""}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={createPlan.isPending}>
              {createPlan.isPending ? "Se salvează…" : "Creează planul"}
            </button>
            {createPlan.isError ? <p className="feedback error">{mutationErrorMessage(createPlan.error)}</p> : null}
          </form>
        </MasterDataCreateModal>
      ) : null}

      {selectedPlan ? (
        <MasterDataCreateModal
          title={selectedPlan.title}
          titleId="ppp-detail-title"
          description={planDetailMeta(selectedPlan)}
          size="wide"
          onClose={closePlanModal}
        >
          <div className="form-stack">
            <section>
              <h4 className="ssm-ppp-subtitle">
                Măsuri
                <span className="ssm-chip">{selectedPlan.measures.length}</span>
              </h4>
              {selectedPlan.measures.length === 0 ? (
                <p className="ssm-ppp-empty">Nu există măsuri în acest plan.</p>
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
            </section>

            <form className="ssm-inline-form form-stack" onSubmit={onAddMeasure}>
              <h4 className="ssm-ppp-subtitle">Măsură nouă</h4>
              <div className="field">
                <label htmlFor="ppp-measure-description">Descriere</label>
                <textarea
                  id="ppp-measure-description"
                  required
                  rows={2}
                  value={measureDescription}
                  placeholder="ex. Montarea balustradelor de protecție la acces depozit"
                  onChange={(event) => setMeasureDescription(event.target.value)}
                />
              </div>
              <div className="ssm-panel-fields-row">
                <div className="field">
                  <label htmlFor="ppp-measure-responsible">Responsabil</label>
                  <input
                    id="ppp-measure-responsible"
                    value={measureResponsible}
                    onChange={(event) => setMeasureResponsible(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ppp-measure-due">Termen</label>
                  <input
                    id="ppp-measure-due"
                    type="date"
                    value={measureDueDate}
                    onChange={(event) => setMeasureDueDate(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMeasure.isPending || !measureDescription.trim()}
                >
                  {createMeasure.isPending ? "Se adaugă…" : "Adaugă măsura"}
                </button>
              </div>
              {createMeasure.isError ? <p className="feedback error">{mutationErrorMessage(createMeasure.error)}</p> : null}
            </form>

            <details className="ssm-ppp-versions">
              <summary>Versiuni ({historyQuery.data?.versions.length ?? 0})</summary>
              <form className="form-stack" onSubmit={onSaveVersion}>
                <div className="field">
                  <label htmlFor="ppp-version-reason">Motivul versiunii noi</label>
                  <input
                    id="ppp-version-reason"
                    required
                    value={versionReason}
                    placeholder="ex. Actualizare după control ITM"
                    onChange={(event) => setVersionReason(event.target.value)}
                  />
                </div>
                <div>
                  <button type="submit" className="btn-secondary" disabled={addVersion.isPending || !versionReason.trim()}>
                    {addVersion.isPending ? "Se salvează…" : "Salvează versiunea"}
                  </button>
                </div>
                {addVersion.isSuccess ? (
                  <p className="feedback success" role="status">
                    Versiune salvată.
                  </p>
                ) : null}
                {addVersion.isError ? <p className="feedback error">{mutationErrorMessage(addVersion.error)}</p> : null}
              </form>
              {historyQuery.isLoading ? <p className="field-hint">Se încarcă istoricul…</p> : null}
              <div className="ssm-history-list">
                {(historyQuery.data?.versions ?? []).map((version) => (
                  <div key={version.id} className="ssm-history-item">
                    <div>
                      <strong>
                        v{version.versionNumber}
                        {version.id === historyQuery.data?.activeVersionId ? " · Activă" : ""}
                      </strong>
                      <div className="field-hint">
                        {version.updateReason} · {formatRoDate(version.createdAt)} · {version.measures.length} măsuri
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {canApprove ? (
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={archivePlan.isPending}
                  onClick={() => archivePlan.mutate(selectedPlan.id, { onSuccess: closePlanModal })}
                >
                  Arhivează planul
                </button>
                {archivePlan.isError ? <p className="feedback error">{mutationErrorMessage(archivePlan.error)}</p> : null}
              </div>
            ) : null}
          </div>
        </MasterDataCreateModal>
      ) : null}
    </section>
  );
}
