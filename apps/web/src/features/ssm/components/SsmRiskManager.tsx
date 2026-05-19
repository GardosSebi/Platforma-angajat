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
            <div className="field">
              <label htmlFor="risk-target-type">Țintă</label>
              <select
                id="risk-target-type"
                value={form.targetType}
                onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value as SsmRiskTargetType, targetId: "" }))}
              >
                {TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {targetOptions.length === 0 ? <p className="field-hint">Nu există date pentru ținta selectată. Rulează seed-ul extins.</p> : null}
            </div>
            <div className="field">
              <label htmlFor="risk-target-id">Post / punct / departament</label>
              <select id="risk-target-id" value={form.targetId} onChange={(e) => setForm((p) => ({ ...p, targetId: e.target.value }))} required>
                <option value="">Selectează ținta</option>
                {targetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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

        <div className="card ssm-doc-card ssm-doc-list">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Evaluări existente</h3>
              <p className="field-hint">Selectează o evaluare pentru istoric și versionare.</p>
            </div>
            <span className="ssm-chip">{assessmentItems.length} total</span>
          </div>
          <div className="ssm-filters">
            <select value={filters.targetType} onChange={(e) => setFilters((p) => ({ ...p, targetType: e.target.value }))}>
              <option value="">Toate țintele</option>
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Toate statusurile</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
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
                  {item.targetType} · {item.targetLabel ?? "-"} · risc {item.riskLevel ?? "-"} · v{item.activeVersionNumber ?? "-"}
                </span>
              </button>
            ))}
            {!assessmentsQuery.isLoading && (assessmentsQuery.data?.items.length ?? 0) === 0 ? (
              <p className="field-hint">Nu există evaluări de risc. Creează una din formularul din stânga.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card ssm-doc-card">
        <div className="ssm-card-header">
          <div>
            <h3 className="card-title">Versionare și istoric</h3>
            <p className="field-hint">
              {selectedAssessment ? `${selectedAssessment.title} · v${selectedAssessment.activeVersionNumber ?? "-"}` : "Nicio evaluare selectată"}
            </p>
          </div>
          <span className="ssm-chip warn">Ultim risc: {latestVersion?.riskLevel ?? "-"}</span>
        </div>
        {selectedAssessmentId ? (
          <>
            <form className="form-stack" onSubmit={onAddVersion}>
              <div className="field">
                <label htmlFor="risk-version-reason">Motiv actualizare</label>
                <input id="risk-version-reason" value={versionReason} onChange={(e) => setVersionReason(e.target.value)} />
              </div>
              <button className="btn-secondary" type="submit" disabled={addVersion.isPending}>
                {addVersion.isPending ? "Se versionează..." : "Adaugă versiune din formular"}
              </button>
              <button className="btn-secondary" type="button" onClick={() => archiveAssessment.mutate(selectedAssessmentId)}>
                Arhivează
              </button>
            </form>
            <div className="ssm-doc-items">
              {(historyQuery.data?.versions ?? []).map((version) => (
                <article key={version.id} className="ssm-doc-item">
                  <strong>
                    v{version.versionNumber} · risc {version.riskLevel}
                  </strong>
                  <span>{version.updateReason}</span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="field-hint">Selectează o evaluare pentru istoric și versionare.</p>
        )}
      </div>
    </section>
  );
}
