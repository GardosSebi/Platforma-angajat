import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  AddSsmRiskAssessmentVersionRequest,
  CreateSsmRiskAssessmentRequest,
  SsmRiskFactor,
  SsmRiskMeasure,
  SsmRiskTargetType
} from "@repo/shared-types/ssm";
import {
  useDepartmentsLookup,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { MasterDataCreateModal } from "../../master-data/components/MasterDataCreateModal";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { SsmExposureSheetsPanel } from "./SsmExposureSheetsPanel";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import {
  useAddRiskAssessmentVersion,
  useArchiveRiskAssessment,
  useCreatePreventionPlanFromRisk,
  useCreateRiskAssessment,
  useRiskAssessmentHistory,
  useRiskAssessments
} from "../hooks/useSsmRisk";
import { riskScore } from "./RiskMatrixPicker";

type RiskTabId = "list" | "exposure";

type RiskFormState = {
  title: string;
  targetType: SsmRiskTargetType;
  targetId: string;
  riskLevel: number;
  updateReason: string;
  factors: SsmRiskFactor[];
  measures: SsmRiskMeasure[];
  effectiveFrom: string;
  createLinkedPreventionPlan: boolean;
};

const RISK_TABS: Array<{ id: RiskTabId; title: string; caption: string }> = [
  { id: "list", title: "Evaluări", caption: "Listă, versiuni și PPP" },
  { id: "exposure", title: "Fișe expunere", caption: "Emitere, semnare, arhivă" }
];

const TARGET_TYPE_OPTIONS = [
  { value: "JOB_POSITION", label: "Post de lucru" },
  { value: "WORKSITE", label: "Punct de lucru" },
  { value: "DEPARTMENT", label: "Departament" }
] as const;

const EMPTY_FACTOR: SsmRiskFactor = { name: "", probability: 3, severity: 3 };
const EMPTY_MEASURE: SsmRiskMeasure = { title: "", owner: "", dueAt: "" };

const EMPTY_FORM: RiskFormState = {
  title: "",
  targetType: "JOB_POSITION",
  targetId: "",
  riskLevel: 9,
  updateReason: "Evaluare inițială",
  factors: [{ ...EMPTY_FACTOR }],
  measures: [{ ...EMPTY_MEASURE }],
  effectiveFrom: new Date().toISOString().slice(0, 10),
  createLinkedPreventionPlan: true
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ro-RO");
}

function targetTypeLabel(type: SsmRiskTargetType): string {
  return TARGET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function maxRiskLevel(factors: SsmRiskFactor[]): number {
  if (factors.length === 0) return 1;
  return Math.max(...factors.map((factor) => riskScore(factor.probability, factor.severity)), 1);
}

function toPayload(form: RiskFormState): CreateSsmRiskAssessmentRequest {
  return {
    title: form.title.trim(),
    targetType: form.targetType,
    jobPositionId: form.targetType === "JOB_POSITION" ? form.targetId : undefined,
    worksiteId: form.targetType === "WORKSITE" ? form.targetId : undefined,
    departmentId: form.targetType === "DEPARTMENT" ? form.targetId : undefined,
    riskLevel: form.riskLevel,
    updateReason: form.updateReason.trim(),
    effectiveFrom: form.effectiveFrom || undefined,
    createLinkedPreventionPlan: form.createLinkedPreventionPlan,
    factors: form.factors
      .filter((factor) => factor.name.trim().length >= 2)
      .map((factor) => ({
        name: factor.name.trim(),
        probability: factor.probability,
        severity: factor.severity
      })),
    measures: form.measures
      .filter((measure) => measure.title.trim().length >= 2)
      .map((measure) => ({
        title: measure.title.trim(),
        owner: measure.owner?.trim() || undefined,
        dueAt: measure.dueAt || undefined
      }))
  };
}

function FactorEditor({
  factors,
  onChange
}: {
  factors: SsmRiskFactor[];
  onChange: (factors: SsmRiskFactor[]) => void;
}) {
  return (
    <div className="ssm-risk-part-list">
      {factors.map((factor, index) => (
        <div key={`factor-${index}`} className="ssm-risk-part-row">
          <input
            aria-label={`Factor ${index + 1}`}
            placeholder="Factor de risc"
            value={factor.name}
            onChange={(event) =>
              onChange(factors.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
            }
          />
          <label>
            P
            <input
              type="number"
              min={1}
              max={5}
              value={factor.probability}
              onChange={(event) => {
                const probability = Math.min(5, Math.max(1, Number(event.target.value) || 1));
                onChange(factors.map((item, i) => (i === index ? { ...item, probability } : item)));
              }}
            />
          </label>
          <label>
            S
            <input
              type="number"
              min={1}
              max={5}
              value={factor.severity}
              onChange={(event) => {
                const severity = Math.min(5, Math.max(1, Number(event.target.value) || 1));
                onChange(factors.map((item, i) => (i === index ? { ...item, severity } : item)));
              }}
            />
          </label>
          <span className="ssm-chip">{riskScore(factor.probability, factor.severity)}</span>
          <button
            type="button"
            className="btn-text"
            disabled={factors.length <= 1}
            onClick={() => onChange(factors.filter((_, i) => i !== index))}
          >
            Șterge
          </button>
        </div>
      ))}
      <button type="button" className="btn-text" onClick={() => onChange([...factors, { ...EMPTY_FACTOR }])}>
        + Factor
      </button>
    </div>
  );
}

function MeasureEditor({
  measures,
  onChange
}: {
  measures: SsmRiskMeasure[];
  onChange: (measures: SsmRiskMeasure[]) => void;
}) {
  return (
    <div className="ssm-risk-part-list">
      {measures.map((measure, index) => (
        <div key={`measure-${index}`} className="ssm-risk-part-row ssm-risk-part-row--measure">
          <input
            aria-label={`Măsură ${index + 1}`}
            placeholder="Măsură de prevenire"
            value={measure.title}
            onChange={(event) =>
              onChange(measures.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))
            }
          />
          <input
            aria-label={`Responsabil ${index + 1}`}
            placeholder="Responsabil"
            value={measure.owner ?? ""}
            onChange={(event) =>
              onChange(measures.map((item, i) => (i === index ? { ...item, owner: event.target.value } : item)))
            }
          />
          <input
            aria-label={`Termen ${index + 1}`}
            type="date"
            value={measure.dueAt ?? ""}
            onChange={(event) =>
              onChange(measures.map((item, i) => (i === index ? { ...item, dueAt: event.target.value } : item)))
            }
          />
          <button
            type="button"
            className="btn-text"
            disabled={measures.length <= 1}
            onClick={() => onChange(measures.filter((_, i) => i !== index))}
          >
            Șterge
          </button>
        </div>
      ))}
      <button type="button" className="btn-text" onClick={() => onChange([...measures, { ...EMPTY_MEASURE }])}>
        + Măsură
      </button>
    </div>
  );
}

export function SsmRiskManager() {
  const session = useAuthSession();
  const canApprove = hasPermission(session?.roles, "ssm:risk:approve");
  const [tab, setTab] = useState<RiskTabId>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ targetType: "", status: "ACTIVE" });
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>();
  const [createForm, setCreateForm] = useState<RiskFormState>(EMPTY_FORM);
  const [manageForm, setManageForm] = useState<RiskFormState | null>(null);
  const [versionReason, setVersionReason] = useState("Actualizare după reevaluare");
  const assessmentsQuery = useRiskAssessments(filters);
  const historyQuery = useRiskAssessmentHistory(selectedAssessmentId);
  const jobsLookup = useJobPositionsLookup();
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const createAssessment = useCreateRiskAssessment();
  const addVersion = useAddRiskAssessmentVersion();
  const archiveAssessment = useArchiveRiskAssessment();
  const createLinkedPlan = useCreatePreventionPlanFromRisk();

  const assessmentItems = assessmentsQuery.data?.items ?? [];
  const selectedAssessment = assessmentItems.find((item) => item.id === selectedAssessmentId);
  const latestVersion = historyQuery.data?.versions[0];
  const createTargetOptions = useMemo(() => {
    if (createForm.targetType === "JOB_POSITION") {
      return mapToOptions(jobsLookup.data?.items ?? [], (job) => job.id, (job) => `${job.code} — ${job.name}`);
    }
    if (createForm.targetType === "WORKSITE") {
      return mapToOptions(
        worksitesLookup.data?.items ?? [],
        (worksite) => worksite.id,
        (worksite) => `${worksite.code} — ${worksite.name}`
      );
    }
    return mapToOptions(
      departmentsLookup.data?.items ?? [],
      (department) => department.id,
      (department) => `${department.code} — ${department.name}`
    );
  }, [createForm.targetType, departmentsLookup.data?.items, jobsLookup.data?.items, worksitesLookup.data?.items]);

  useEffect(() => {
    if (!createTargetOptions.length) return;
    if (createTargetOptions.some((option) => option.value === createForm.targetId)) return;
    setCreateForm((prev) => ({ ...prev, targetId: createTargetOptions[0].value }));
  }, [createForm.targetId, createTargetOptions]);

  useEffect(() => {
    if (!selectedAssessmentId || !latestVersion || !selectedAssessment) {
      setManageForm(null);
      return;
    }
    setManageForm({
      title: selectedAssessment.title,
      targetType: selectedAssessment.targetType,
      targetId: selectedAssessment.targetId ?? "",
      riskLevel: latestVersion.riskLevel,
      updateReason: latestVersion.updateReason,
      effectiveFrom: latestVersion.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      createLinkedPreventionPlan: false,
      factors:
        latestVersion.factors.length > 0
          ? latestVersion.factors.map((factor) => ({
              name: factor.name,
              probability: factor.probability,
              severity: factor.severity
            }))
          : [{ ...EMPTY_FACTOR }],
      measures:
        latestVersion.measures.length > 0
          ? latestVersion.measures.map((measure) => ({
              title: measure.title,
              owner: measure.owner ?? "",
              dueAt: measure.dueAt ? measure.dueAt.slice(0, 10) : ""
            }))
          : [{ ...EMPTY_MEASURE }]
    });
  }, [latestVersion, selectedAssessment, selectedAssessmentId]);

  const openCreate = () => {
    createAssessment.reset();
    setCreateOpen(true);
  };
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const openManage = (assessmentId: string) => {
    addVersion.reset();
    createLinkedPlan.reset();
    setVersionReason("Actualizare după reevaluare");
    setSelectedAssessmentId(assessmentId);
  };
  const closeManage = useCallback(() => setSelectedAssessmentId(undefined), []);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    createAssessment.mutate(toPayload(createForm), {
      onSuccess: () => {
        setCreateOpen(false);
        setCreateForm(EMPTY_FORM);
      }
    });
  };

  const onAddVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAssessmentId || !manageForm) return;
    const versionSource = toPayload({ ...manageForm, updateReason: versionReason });
    const payload: AddSsmRiskAssessmentVersionRequest = {
      riskLevel: versionSource.riskLevel,
      updateReason: versionReason,
      factors: versionSource.factors,
      measures: versionSource.measures,
      effectiveFrom: versionSource.effectiveFrom
    };
    addVersion.mutate({ assessmentId: selectedAssessmentId, payload });
  };

  return (
    <section className="ssm-eip-panel" aria-label="Modul evaluări risc">
      <div className="ssm-panel-tabs ssm-panel-tabs--2" role="tablist" aria-label="Secțiuni evaluări risc">
        {RISK_TABS.map((item) => (
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

      {tab === "list" ? (
        <div className="ssm-panel-layout ssm-panel-layout--single">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Evaluări ({assessmentItems.length})
              </h4>
              <button type="button" className="btn-primary" onClick={openCreate}>
                Evaluare nouă
              </button>
            </div>

            <div className="ssm-filters">
              <FieldSelect
                variant="inline"
                id="risk-filter-target"
                value={filters.targetType}
                onChange={(targetType) => setFilters((prev) => ({ ...prev, targetType }))}
                allowEmpty
                emptyLabel="Toate țintele"
                options={[...TARGET_TYPE_OPTIONS]}
              />
              <FieldSelect
                variant="inline"
                id="risk-filter-status"
                value={filters.status}
                onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
                allowEmpty
                emptyLabel="Toate statusurile"
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "ARCHIVED", label: "Arhivate" }
                ]}
              />
            </div>

            {assessmentsQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
            <div className="ssm-history-list">
              {assessmentItems.map((item) => (
                <div key={item.id} className="ssm-history-item">
                  <div>
                    <strong>{item.title}</strong>
                    <div className="field-hint">
                      {targetTypeLabel(item.targetType)} · {item.targetLabel ?? "—"} · risc {item.riskLevel ?? "—"} · v
                      {item.activeVersionNumber ?? "—"}
                      {(item.preventionPlans?.length ?? 0) > 0 ? ` · PPP ${item.preventionPlans.length}` : ""}
                    </div>
                  </div>
                  <div className="ssm-inline-actions">
                    <span className={item.status === "ACTIVE" ? "badge-good" : "badge-bad"}>{item.status}</span>
                    <button type="button" className="btn-text" onClick={() => openManage(item.id)}>
                      Deschide
                    </button>
                  </div>
                </div>
              ))}
              {!assessmentsQuery.isLoading && assessmentItems.length === 0 ? (
                <p className="field-hint">Nu există evaluări. Adaugă prima evaluare.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <MasterDataCreateModal
          title="Evaluare de risc nouă"
          titleId="risk-create-modal-title"
          size="wide"
          onClose={closeCreate}
        >
          <form className="form-stack" onSubmit={onCreate}>
            <div className="field">
              <label htmlFor="risk-create-title">Titlu</label>
              <input
                id="risk-create-title"
                required
                value={createForm.title}
                placeholder="Ex. Evaluare risc Operator linie"
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>

            <FieldSelect
              id="risk-create-target-type"
              label="Tip țintă"
              value={createForm.targetType}
              onChange={(targetType) =>
                setCreateForm((prev) => ({
                  ...prev,
                  targetType: targetType as SsmRiskTargetType,
                  targetId: ""
                }))
              }
              options={[...TARGET_TYPE_OPTIONS]}
            />

            <FieldSelect
              id="risk-create-target-id"
              label={targetTypeLabel(createForm.targetType)}
              value={createForm.targetId}
              onChange={(targetId) => setCreateForm((prev) => ({ ...prev, targetId }))}
              required
              allowEmpty
              emptyLabel="Selectează"
              options={createTargetOptions}
            />

            <div className="field">
              <label htmlFor="risk-create-reason">Motiv</label>
              <input
                id="risk-create-reason"
                required
                value={createForm.updateReason}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, updateReason: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="risk-create-level">Nivel risc (max P×S)</label>
              <input id="risk-create-level" value={createForm.riskLevel} readOnly aria-readonly="true" />
            </div>

            <div className="field">
              <span className="field-label">Factori</span>
              <FactorEditor
                factors={createForm.factors}
                onChange={(factors) =>
                  setCreateForm((prev) => ({ ...prev, factors, riskLevel: maxRiskLevel(factors) }))
                }
              />
            </div>

            <div className="field">
              <span className="field-label">Măsuri</span>
              <MeasureEditor
                measures={createForm.measures}
                onChange={(measures) => setCreateForm((prev) => ({ ...prev, measures }))}
              />
            </div>

            <label className="ssm-check-inline">
              <input
                type="checkbox"
                checked={createForm.createLinkedPreventionPlan}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, createLinkedPreventionPlan: event.target.checked }))
                }
              />
              Creează și Plan PPP din măsuri
            </label>

            <button className="btn-primary" type="submit" disabled={createAssessment.isPending || !createForm.targetId}>
              {createAssessment.isPending ? "Se salvează…" : "Salvează evaluarea"}
            </button>
            {createAssessment.isError ? (
              <p className="feedback error">{mutationErrorMessage(createAssessment.error)}</p>
            ) : null}
          </form>
        </MasterDataCreateModal>
      ) : null}

      {selectedAssessment ? (
        <MasterDataCreateModal
          title={selectedAssessment.title}
          titleId="risk-manage-modal-title"
          description={`${targetTypeLabel(selectedAssessment.targetType)} · ${selectedAssessment.targetLabel ?? "—"} · actualizat ${formatRoDate(selectedAssessment.updatedAt)}`}
          size="wide"
          onClose={closeManage}
        >
          {manageForm ? (
            <form className="form-stack" onSubmit={onAddVersion}>

              <div className="ssm-badge-row">
                <span className="ssm-chip warn">Risc {manageForm.riskLevel}</span>
                <span className="ssm-chip">v{selectedAssessment.activeVersionNumber ?? "—"}</span>
              </div>

              <div className="field">
                <span className="field-label">Factori</span>
                <FactorEditor
                  factors={manageForm.factors}
                  onChange={(factors) =>
                    setManageForm((prev) => (prev ? { ...prev, factors, riskLevel: maxRiskLevel(factors) } : prev))
                  }
                />
              </div>

              <div className="field">
                <span className="field-label">Măsuri</span>
                <MeasureEditor
                  measures={manageForm.measures}
                  onChange={(measures) => setManageForm((prev) => (prev ? { ...prev, measures } : prev))}
                />
              </div>

              <div className="field">
                <label htmlFor="risk-manage-reason">Motiv versiune nouă</label>
                <input
                  id="risk-manage-reason"
                  required
                  value={versionReason}
                  onChange={(event) => setVersionReason(event.target.value)}
                />
              </div>

              <div className="ssm-inline-actions">
                <button className="btn-primary" type="submit" disabled={addVersion.isPending}>
                  {addVersion.isPending ? "Se salvează…" : "Salvează versiune"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={createLinkedPlan.isPending}
                  onClick={() => createLinkedPlan.mutate(selectedAssessment.id)}
                >
                  {createLinkedPlan.isPending ? "Se creează…" : "Generează Plan PPP"}
                </button>
                {canApprove ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={archiveAssessment.isPending || selectedAssessment.status === "ARCHIVED"}
                  onClick={() =>
                    archiveAssessment.mutate(selectedAssessment.id, {
                      onSuccess: () => setSelectedAssessmentId(undefined)
                    })
                  }
                >
                  Arhivează
                </button>
                ) : null}
              </div>
              {addVersion.isError ? <p className="feedback error">{mutationErrorMessage(addVersion.error)}</p> : null}
              {createLinkedPlan.isError ? (
                <p className="feedback error">{mutationErrorMessage(createLinkedPlan.error)}</p>
              ) : null}

              {(selectedAssessment.preventionPlans?.length ?? 0) > 0 ? (
                <div>
                  <h5 className="ssm-subtitle">Planuri PPP legate</h5>
                  <div className="ssm-history-list">
                    {selectedAssessment.preventionPlans.map((plan) => (
                      <div key={plan.id} className="ssm-history-item">
                        <div>
                          <strong>{plan.title}</strong>
                          <div className="field-hint">
                            {plan.openMeasures}/{plan.measureCount} măsuri deschise
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h5 className="ssm-subtitle">Istoric versiuni</h5>
                {historyQuery.isLoading ? <p className="field-hint">Se încarcă istoricul…</p> : null}
                <div className="ssm-history-list">
                  {(historyQuery.data?.versions ?? []).map((version) => (
                    <div key={version.id} className="ssm-history-item">
                      <div>
                        <strong>
                          v{version.versionNumber} · risc {version.riskLevel}
                        </strong>
                        <div className="field-hint">
                          {version.updateReason} · {formatRoDate(version.createdAt)}
                          {version.effectiveFrom ? ` · efectiv ${formatRoDate(version.effectiveFrom)}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <p className="field-hint">Se încarcă evaluarea…</p>
          )}
        </MasterDataCreateModal>
      ) : null}

      {tab === "exposure" ? <SsmExposureSheetsPanel /> : null}
    </section>
  );
}
