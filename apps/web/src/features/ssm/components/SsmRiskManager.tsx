import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AddSsmRiskAssessmentVersionRequest,
  CreateSsmRiskAssessmentRequest,
  SsmRiskTargetType
} from "@repo/shared-types/ssm";
import {
  useDepartmentsLookup,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions, stringOptions } from "../../../shared/components/field-select-options";
import {
  useAddRiskAssessmentVersion,
  useArchiveRiskAssessment,
  useCreateRiskAssessment,
  useRiskAssessmentHistory,
  useRiskAssessments
} from "../hooks/useSsmRisk";

type RiskFormState = {
  title: string;
  targetType: SsmRiskTargetType;
  targetId: string;
  riskLevel: number;
  probability: number;
  severity: number;
  updateReason: string;
  factorsText: string;
  measuresText: string;
  effectiveFrom: string;
};

const TARGET_TYPES: SsmRiskTargetType[] = ["JOB_POSITION", "WORKSITE", "DEPARTMENT"];

const EMPTY_RISK_FORM: RiskFormState = {
  title: "Evaluare risc post Operator linie",
  targetType: "JOB_POSITION",
  targetId: "",
  riskLevel: 12,
  probability: 3,
  severity: 4,
  updateReason: "Evaluare initiala pentru post/loc de munca",
  factorsText: "Contact cu piese in miscare\nZgomot peste prag operational",
  measuresText: "Protectii mecanice si oprire de urgenta\nInstruire periodica si verificare semnalizare",
  effectiveFrom: new Date().toISOString().slice(0, 10)
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toPayload(form: RiskFormState): CreateSsmRiskAssessmentRequest {
  const target = {
    jobPositionId: form.targetType === "JOB_POSITION" ? form.targetId : undefined,
    worksiteId: form.targetType === "WORKSITE" ? form.targetId : undefined,
    departmentId: form.targetType === "DEPARTMENT" ? form.targetId : undefined
  };
  return {
    title: form.title,
    targetType: form.targetType,
    ...target,
    riskLevel: form.riskLevel,
    updateReason: form.updateReason,
    effectiveFrom: form.effectiveFrom || undefined,
    factors: lines(form.factorsText).map((name) => ({
      name,
      probability: form.probability,
      severity: form.severity
    })),
    measures: lines(form.measuresText).map((title) => ({ title }))
  };
}

export function SsmRiskManager() {
  const [filters, setFilters] = useState({ targetType: "", status: "" });
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>();
  const [form, setForm] = useState<RiskFormState>(EMPTY_RISK_FORM);
  const [versionReason, setVersionReason] = useState("Actualizare masuri dupa reevaluare");

  const assessmentsQuery = useRiskAssessments(filters);
  const historyQuery = useRiskAssessmentHistory(selectedAssessmentId);
  const jobsLookup = useJobPositionsLookup();
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();

  const createAssessment = useCreateRiskAssessment();
  const addVersion = useAddRiskAssessmentVersion();
  const archiveAssessment = useArchiveRiskAssessment();
  const assessmentItems = assessmentsQuery.data?.items ?? [];
  const selectedAssessment = assessmentItems.find((item) => item.id === selectedAssessmentId);
  const latestVersion = historyQuery.data?.versions[0];

  const targetOptions = useMemo(() => {
    if (form.targetType === "JOB_POSITION") {
      return (jobsLookup.data?.items ?? []).map((job) => ({ id: job.id, label: `${job.code} - ${job.name}` }));
    }
    if (form.targetType === "WORKSITE") {
      return (worksitesLookup.data?.items ?? []).map((worksite) => ({
        id: worksite.id,
        label: `${worksite.code} - ${worksite.name}`
      }));
    }
    return (departmentsLookup.data?.items ?? []).map((department) => ({
      id: department.id,
      label: `${department.code} - ${department.name}`
    }));
  }, [departmentsLookup.data?.items, form.targetType, jobsLookup.data?.items, worksitesLookup.data?.items]);

  useEffect(() => {
    if (targetOptions.length === 0) return;
    setForm((prev) => {
      if (targetOptions.some((option) => option.id === prev.targetId)) {
        return prev;
      }
      return { ...prev, targetId: targetOptions[0].id };
    });
  }, [targetOptions]);

  useEffect(() => {
    const items = assessmentsQuery.data?.items ?? [];
    if (items.length === 0) return;
    if (selectedAssessmentId && items.some((item) => item.id === selectedAssessmentId)) {
      return;
    }
    setSelectedAssessmentId(items[0].id);
  }, [assessmentsQuery.data?.items, selectedAssessmentId]);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    createAssessment.mutate(toPayload(form), {
      onSuccess: (result) => {
        setSelectedAssessmentId(result.assessmentId);
      }
    });
  };

  const onAddVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAssessmentId) return;
    const versionSource = toPayload({ ...form, updateReason: versionReason });
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
    <section className="ssm-documents" aria-labelledby="risk-title">
      <div className="ssm-module-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea H · 3.8</p>
          <h2 id="risk-title" className="card-title">
            Evaluări risc + PPP
          </h2>
          <p className="ssm-hero-lead">
            Creează evaluări pe post, punct de lucru sau departament, apoi păstrează istoricul cu motivul fiecărei actualizări.
          </p>
          <div className="ssm-badge-row">
            <span className="ssm-chip">Factori</span>
            <span className="ssm-chip">Nivel risc</span>
            <span className="ssm-chip">Măsuri PPP</span>
          </div>
        </div>

        <div className="ssm-summary-strip">
          <div className="ssm-stat-card">
            <span>Evaluări</span>
            <strong>{assessmentItems.length}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Selectată</span>
            <strong>{selectedAssessment?.riskLevel ?? "-"}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Versiuni</span>
            <strong>{historyQuery.data?.versions.length ?? "-"}</strong>
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreate}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Evaluare nouă</h3>
              <p className="field-hint">Completează ținta, factorii și măsurile. Prima salvare creează versiunea v1.</p>
            </div>
          </div>
          <div className="ssm-form-grid">
            <div className="field wide">
              <label htmlFor="risk-title-input">Titlu</label>
              <input id="risk-title-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
            </div>
            <FieldSelect
              id="risk-target-type"
              label="Țintă"
              value={form.targetType}
              onChange={(targetType) =>
                setForm((p) => ({ ...p, targetType: targetType as SsmRiskTargetType, targetId: "" }))
              }
              options={stringOptions(TARGET_TYPES)}
              hint={
                targetOptions.length === 0
                  ? "Nu există date pentru ținta selectată. Rulează seed-ul extins."
                  : undefined
              }
            />
            <FieldSelect
              id="risk-target-id"
              label="Post / punct / departament"
              value={form.targetId}
              onChange={(targetId) => setForm((p) => ({ ...p, targetId }))}
              required
              allowEmpty
              emptyLabel="Selectează ținta"
              options={mapToOptions(
                targetOptions,
                (option) => option.id,
                (option) => option.label
              )}
            />
            <div className="field">
              <label htmlFor="risk-level">Nivel risc global</label>
              <input id="risk-level" type="number" min={1} max={25} value={form.riskLevel} onChange={(e) => setForm((p) => ({ ...p, riskLevel: Number(e.target.value || 1) }))} />
            </div>
            <div className="field">
              <label htmlFor="risk-reason">Motiv versiune</label>
              <input id="risk-reason" value={form.updateReason} onChange={(e) => setForm((p) => ({ ...p, updateReason: e.target.value }))} required />
            </div>
            <div className="field wide">
              <label htmlFor="risk-factors">Factori de risc (unul pe linie)</label>
              <textarea id="risk-factors" value={form.factorsText} onChange={(e) => setForm((p) => ({ ...p, factorsText: e.target.value }))} rows={4} />
            </div>
            <div className="field wide">
              <label htmlFor="risk-measures">Măsuri / PPP (una pe linie)</label>
              <textarea id="risk-measures" value={form.measuresText} onChange={(e) => setForm((p) => ({ ...p, measuresText: e.target.value }))} rows={4} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={createAssessment.isPending || !form.targetId}>
            {createAssessment.isPending ? "Se salvează..." : "Adaugă evaluare"}
          </button>
          {createAssessment.isError ? <p className="feedback error">{mutationErrorMessage(createAssessment.error)}</p> : null}
        </form>

        <div className="ssm-doc-side-column">
          <div className="card ssm-doc-card ssm-doc-list">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Evaluări existente</h3>
                <p className="field-hint">Selectează o evaluare pentru istoric și versionare.</p>
              </div>
              <span className="ssm-chip">{assessmentItems.length} total</span>
            </div>
            <div className="ssm-filters">
              <FieldSelect
                variant="inline"
                id="risk-filter-target"
                value={filters.targetType}
                onChange={(targetType) => setFilters((p) => ({ ...p, targetType }))}
                allowEmpty
                emptyLabel="Toate țintele"
                options={stringOptions(TARGET_TYPES)}
              />
              <FieldSelect
                variant="inline"
                id="risk-filter-status"
                value={filters.status}
                onChange={(status) => setFilters((p) => ({ ...p, status }))}
                allowEmpty
                emptyLabel="Toate statusurile"
                options={stringOptions(["ACTIVE", "ARCHIVED"])}
              />
            </div>
            <div className="ssm-doc-items">
              {assessmentsQuery.isLoading ? <p className="field-hint">Se încarcă evaluările...</p> : null}
              {assessmentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ssm-doc-item ${selectedAssessmentId === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedAssessmentId(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {item.targetType} · {item.targetLabel ?? "-"} · risc {item.riskLevel ?? "-"} · v
                    {item.activeVersionNumber ?? "-"}
                  </span>
                </button>
              ))}
              {!assessmentsQuery.isLoading && assessmentItems.length === 0 ? (
                <p className="field-hint">Nu există evaluări de risc. Creează una din formularul din stânga.</p>
              ) : null}
            </div>
          </div>

          {selectedAssessmentId ? (
            <div className="card ssm-doc-card ssm-risk-version-card" aria-labelledby="risk-version-title">
              <div className="ssm-card-header">
                <div>
                  <h3 id="risk-version-title" className="card-title">
                    Versionare și istoric
                  </h3>
                  {selectedAssessment ? (
                    <p className="field-hint">
                      {selectedAssessment.title} · v{selectedAssessment.activeVersionNumber ?? "-"}
                    </p>
                  ) : null}
                </div>
                <span className="ssm-chip warn">Risc: {latestVersion?.riskLevel ?? selectedAssessment?.riskLevel ?? "-"}</span>
              </div>
              <form className="form-stack ssm-risk-version-form" onSubmit={onAddVersion}>
                <div className="field">
                  <label htmlFor="risk-version-reason">Motiv actualizare</label>
                  <input id="risk-version-reason" value={versionReason} onChange={(e) => setVersionReason(e.target.value)} />
                </div>
                <div className="ssm-risk-version-actions">
                  <button className="btn-secondary" type="submit" disabled={addVersion.isPending}>
                    {addVersion.isPending ? "Se salvează..." : "Versiune nouă"}
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => archiveAssessment.mutate(selectedAssessmentId)}>
                    Arhivează
                  </button>
                </div>
              </form>
              {historyQuery.isLoading ? <p className="field-hint">Se încarcă istoricul...</p> : null}
              <div className="ssm-risk-version-history" aria-label="Istoric versiuni">
                {(historyQuery.data?.versions ?? []).map((version) => (
                  <article key={version.id} className="ssm-doc-item">
                    <strong>
                      v{version.versionNumber} · risc {version.riskLevel}
                    </strong>
                    <span>{version.updateReason}</span>
                  </article>
                ))}
                {!historyQuery.isLoading && (historyQuery.data?.versions.length ?? 0) === 0 ? (
                  <p className="field-hint">Nu există versiuni în istoric.</p>
                ) : null}
              </div>
            </div>
          ) : assessmentItems.length > 0 ? (
            <p className="ssm-empty-inline">Selectează o evaluare din listă pentru versionare.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
