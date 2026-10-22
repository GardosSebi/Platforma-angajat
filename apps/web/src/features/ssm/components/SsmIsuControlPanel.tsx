import { useState } from "react";
import type { SsmIsuTraffic, SsmPsiResponsibleRole } from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import { useIsuReadiness } from "../hooks/useSsmPsi";

type PsiTarget = "docs" | "equipment" | "trainings" | "responsibles" | "drills";

const TRAFFIC_LABELS: Record<SsmIsuTraffic, string> = {
  GREEN: "Pregătit",
  YELLOW: "Parțial",
  RED: "Nepregătit"
};

const TRAFFIC_CHIP: Record<SsmIsuTraffic, string> = {
  GREEN: "ssm-chip good",
  YELLOW: "ssm-chip warn",
  RED: "ssm-chip bad"
};

const ROLE_LABELS: Record<SsmPsiResponsibleRole, string> = {
  PSI_RESPONSIBLE: "Responsabil PSI",
  EMERGENCY_COORDINATOR: "Coordonator urgențe",
  EVACUATION_RESPONSIBLE: "Responsabil evacuare",
  FIRST_AID_RESPONSIBLE: "Prim ajutor"
};

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ro-RO");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function SsmIsuControlPanel({ onOpenTab }: { onOpenTab: (tab: PsiTarget) => void }) {
  const session = useAuthSession();
  const canExport = hasPermission(session?.roles, "ssm:reports:export");
  const [worksiteId, setWorksiteId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const worksites = useWorksitesLookup();
  const readiness = useIsuReadiness(worksiteId || undefined);
  const summary = readiness.data?.summary;

  const exportPackage = () => {
    setExporting(true);
    setExportError(null);
    downloadWithAuth(
      ssmApi.getIsuControlPackageUrl(worksiteId || undefined),
      `pachet-control-isu-${new Date().toISOString().slice(0, 10)}.zip`
    )
      .catch((error: unknown) => setExportError(errorMessage(error)))
      .finally(() => setExporting(false));
  };

  return (
    <div className="ssm-panel-layout ssm-panel-layout--single">
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-card-header">
          <h4 className="card-title">Pregătire pentru controlul ISU</h4>
          {canExport ? (
            <button type="button" className="btn-primary" disabled={exporting} onClick={exportPackage}>
              {exporting ? "Se generează pachetul…" : "Descarcă pachetul de control ISU (ZIP)"}
            </button>
          ) : null}
        </div>
        <p className="field-hint">
          Analog dosarului ITM, pe apărarea împotriva incendiilor: plan de evacuare și instrucțiuni PSI aprobate,
          verificările stingătoarelor și ale celorlalte mijloace de stingere, exercițiile de evacuare, personalul cu
          instruire PSI valabilă și persoanele desemnate. Pachetul conține un sumar PDF, documentele aprobate, registrele
          CSV și dovezile atașate.
        </p>
        {exportError ? <p className="feedback error">{exportError}</p> : null}

        <FieldSelect
          id="isu-worksite"
          label="Punct de lucru"
          value={worksiteId}
          onChange={setWorksiteId}
          allowEmpty
          emptyLabel="Toate punctele de lucru"
          options={mapToOptions(worksites.data?.items ?? [], (site) => site.id, (site) => `${site.code} — ${site.name}`)}
        />

        {summary ? (
          <div className="ssm-isu-summary">
            <div>
              <strong>{summary.averageScore}%</strong>
              <span>scor mediu</span>
            </div>
            <div>
              <strong>{summary.green}</strong>
              <span>pregătite</span>
            </div>
            <div>
              <strong>{summary.yellow}</strong>
              <span>parțial</span>
            </div>
            <div>
              <strong>{summary.red}</strong>
              <span>nepregătite</span>
            </div>
          </div>
        ) : null}
        {readiness.isLoading ? <p className="field-hint">Se calculează situația…</p> : null}
        {readiness.isError ? <p className="feedback error">{errorMessage(readiness.error)}</p> : null}
      </div>

      {readiness.data?.items.map((site) => (
        <div key={site.worksiteId} className="card form-stack ssm-doc-card ssm-isu-site">
          <div className="ssm-card-header">
            <h4 className="card-title">
              {site.worksiteCode} — {site.worksiteName}
            </h4>
            <span className={TRAFFIC_CHIP[site.traffic]}>
              {site.score}% · {TRAFFIC_LABELS[site.traffic]}
            </span>
          </div>
          {site.legalEntityName ? <p className="field-hint">{site.legalEntityName}</p> : null}
          <div className="ssm-isu-score" aria-hidden="true">
            <span style={{ width: `${site.score}%` }} className={`ssm-isu-score__bar ssm-isu-score__bar--${site.traffic.toLowerCase()}`} />
          </div>

          <div className="ssm-isu-grid">
            <button type="button" className="ssm-isu-check" onClick={() => onOpenTab("docs")}>
              <strong>Documentație PSI</strong>
              <span className={site.documents.evacuationPlan ? "ssm-chip good" : "ssm-chip bad"}>Plan evacuare</span>
              <span className={site.documents.instructions ? "ssm-chip good" : "ssm-chip bad"}>Instrucțiuni</span>
              <span className={site.documents.intervention ? "ssm-chip good" : "ssm-chip bad"}>Plan intervenție</span>
            </button>
            <button type="button" className="ssm-isu-check" onClick={() => onOpenTab("equipment")}>
              <strong>Mijloace de stingere</strong>
              <span>
                {site.equipment.ok + site.equipment.dueSoon}/{site.equipment.total} verificate în termen
              </span>
              <span className="field-hint">
                {site.equipment.byCategory.EXTINGUISHER} stingătoare · {site.equipment.byCategory.HYDRANT} hidranți
              </span>
              {site.equipment.overdue ? <span className="ssm-chip bad">{site.equipment.overdue} expirate</span> : null}
              {site.equipment.dueSoon ? <span className="ssm-chip warn">{site.equipment.dueSoon} scadente ≤30 zile</span> : null}
              {site.equipment.neverVerified ? (
                <span className="ssm-chip bad">{site.equipment.neverVerified} neverificate</span>
              ) : null}
            </button>
            <button type="button" className="ssm-isu-check" onClick={() => onOpenTab("drills")}>
              <strong>Simulări de evacuare</strong>
              <span>Ultima: {formatRoDate(site.drills.lastConductedAt)}</span>
              <span className="field-hint">
                {site.drills.countLast12Months} în ultimele 12 luni · următoarea {formatRoDate(site.drills.nextDueAt)}
              </span>
              {site.drills.overdue ? <span className="ssm-chip bad">Restantă</span> : <span className="ssm-chip good">În termen</span>}
            </button>
            <button type="button" className="ssm-isu-check" onClick={() => onOpenTab("trainings")}>
              <strong>Personal instruit PSI</strong>
              <span>
                {site.personnel.trained}/{site.personnel.activeEmployees} ({site.personnel.coveragePercent}%)
              </span>
              {site.personnel.untrained.length ? (
                <span className="field-hint">
                  Fără instruire: {site.personnel.untrained.slice(0, 5).map((row) => row.fullName).join(", ")}
                  {site.personnel.untrained.length > 5 ? ` și încă ${site.personnel.untrained.length - 5}` : ""}
                </span>
              ) : null}
            </button>
            <button type="button" className="ssm-isu-check" onClick={() => onOpenTab("responsibles")}>
              <strong>Persoane desemnate</strong>
              {site.responsibles.roles.map((row) => (
                <span key={row.role} className="field-hint">
                  {ROLE_LABELS[row.role]}: {row.persons.length ? row.persons.join(", ") : "—"}
                </span>
              ))}
            </button>
          </div>

          {site.gaps.length ? (
            <div className="callout-warn" role="status">
              <strong>De remediat înainte de control</strong>
              <ul>
                {site.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="feedback success">Toate cerințele verificate sunt îndeplinite.</p>
          )}
        </div>
      ))}
    </div>
  );
}
