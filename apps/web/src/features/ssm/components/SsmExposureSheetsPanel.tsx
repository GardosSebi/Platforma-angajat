import { useMemo, useState } from "react";
import {
  SSM_EXPOSURE_SHEET_STATUS_LABELS,
  SSM_EXPOSURE_SHEET_TRIGGER_LABELS,
  type SsmExposureCoverageState
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useJobPositionsLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import {
  useExposureCoverage,
  useExposureSheets,
  useIssueExposureSheet,
  useIssueMissingExposureSheets,
  useSignExposureAssessor
} from "../hooks/useSsmExposure";

const COVERAGE_LABELS: Record<SsmExposureCoverageState, string> = {
  SIGNED: "Semnată",
  PENDING: "În semnare",
  OUTDATED: "Neactualizată",
  MISSING: "Lipsă",
  NO_ASSESSMENT: "Post fără evaluare"
};

function coverageChip(state: SsmExposureCoverageState): string {
  if (state === "SIGNED") return "ssm-chip good";
  if (state === "PENDING") return "ssm-chip warn";
  if (state === "NO_ASSESSMENT") return "ssm-chip";
  return "ssm-chip bad";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ro-RO");
}

export function SsmExposureSheetsPanel() {
  const session = useAuthSession();
  const canEdit = hasPermission(session?.roles, "ssm:risk:edit");
  const canApprove = hasPermission(session?.roles, "ssm:risk:approve");
  const [filters, setFilters] = useState({ jobPositionId: "", worksiteId: "" });
  const [stateFilter, setStateFilter] = useState<SsmExposureCoverageState | "">("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [assessorForm, setAssessorForm] = useState({ assessorName: "", assessorFunction: "", signature: "" });
  const [signingSheetId, setSigningSheetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const jobsLookup = useJobPositionsLookup();
  const worksitesLookup = useWorksitesLookup();
  const coverageQuery = useExposureCoverage({
    jobPositionId: filters.jobPositionId || undefined,
    worksiteId: filters.worksiteId || undefined
  });
  const sheetsQuery = useExposureSheets({ employeeId: selectedEmployeeId }, Boolean(selectedEmployeeId));
  const issueSheet = useIssueExposureSheet();
  const issueMissing = useIssueMissingExposureSheets();
  const signAssessor = useSignExposureAssessor();

  const summary = coverageQuery.data?.summary;
  const items = useMemo(
    () => (coverageQuery.data?.items ?? []).filter((item) => !stateFilter || item.state === stateFilter),
    [coverageQuery.data?.items, stateFilter]
  );
  const selected = coverageQuery.data?.items.find((item) => item.employeeId === selectedEmployeeId);
  const sheets = sheetsQuery.data?.items ?? [];

  const download = (url: string, fileName: string) => {
    setActionError(null);
    void downloadWithAuth(url, fileName).catch((error: unknown) => setActionError(errorMessage(error)));
  };

  return (
    <div className="ssm-panel-layout">
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-card-header">
          <h4 className="card-title">Acoperire fișe de expunere</h4>
          {canEdit ? (
            <button
              type="button"
              className="btn-primary"
              disabled={issueMissing.isPending}
              onClick={() =>
                issueMissing.mutate({
                  jobPositionId: filters.jobPositionId || undefined,
                  worksiteId: filters.worksiteId || undefined
                })
              }
            >
              {issueMissing.isPending ? "Se emit…" : "Emite fișele lipsă / neactualizate"}
            </button>
          ) : null}
        </div>
        <p className="field-hint">
          Fiecare angajat primește automat fișa la angajare, la schimbarea postului și la fiecare versiune nouă a
          evaluării de risc pentru post. Fișa devine definitivă după semnătura lucrătorului și a evaluatorului și se
          arhivează în dosarul digital.
        </p>
        {issueMissing.isSuccess ? (
          <p className="feedback success">
            Au fost emise {issueMissing.data.issued} fișe.
            {issueMissing.data.noAssessment
              ? ` ${issueMissing.data.noAssessment} angajați au posturi fără evaluare de risc activă.`
              : ""}
          </p>
        ) : null}
        {issueMissing.isError ? <p className="feedback error">{errorMessage(issueMissing.error)}</p> : null}

        {summary ? (
          <div className="ssm-exposure-summary">
            {(Object.keys(COVERAGE_LABELS) as SsmExposureCoverageState[]).map((state) => (
              <button
                key={state}
                type="button"
                className={`ssm-exposure-summary__item ${stateFilter === state ? "active" : ""}`}
                onClick={() => setStateFilter((prev) => (prev === state ? "" : state))}
              >
                <strong>{summary[state]}</strong>
                <span>{COVERAGE_LABELS[state]}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="ssm-inline-actions">
          <FieldSelect
            id="exposure-filter-job"
            label="Post"
            value={filters.jobPositionId}
            onChange={(jobPositionId) => setFilters((prev) => ({ ...prev, jobPositionId }))}
            allowEmpty
            emptyLabel="Toate posturile"
            options={mapToOptions(jobsLookup.data?.items ?? [], (job) => job.id, (job) => `${job.code} — ${job.name}`)}
          />
          <FieldSelect
            id="exposure-filter-worksite"
            label="Punct de lucru"
            value={filters.worksiteId}
            onChange={(worksiteId) => setFilters((prev) => ({ ...prev, worksiteId }))}
            allowEmpty
            emptyLabel="Toate punctele"
            options={mapToOptions(
              worksitesLookup.data?.items ?? [],
              (site) => site.id,
              (site) => `${site.code} — ${site.name}`
            )}
          />
        </div>

        {coverageQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
        {coverageQuery.isError ? <p className="feedback error">{errorMessage(coverageQuery.error)}</p> : null}
        <div className="ssm-doc-items">
          {items.map((item) => (
            <button
              key={item.employeeId}
              type="button"
              className={`ssm-doc-item ${selectedEmployeeId === item.employeeId ? "selected" : ""}`}
              onClick={() => {
                setSelectedEmployeeId(item.employeeId);
                setSigningSheetId(null);
              }}
            >
              <strong>{item.employeeName}</strong>
              <span>
                {item.jobPositionName ?? "Fără post"}
                {item.worksiteName ? ` · ${item.worksiteName}` : ""}
                {item.signedAt ? ` · semnată ${formatRoDate(item.signedAt)}` : ""}
              </span>
              <span className={coverageChip(item.state)}>{COVERAGE_LABELS[item.state]}</span>
            </button>
          ))}
          {!coverageQuery.isLoading && !items.length ? <p className="field-hint">Niciun angajat în filtru.</p> : null}
        </div>
      </div>

      <div className="card form-stack ssm-doc-card">
        {!selected ? (
          <p className="field-hint">Selectează un angajat pentru istoricul fișelor și semnare.</p>
        ) : (
          <>
            <div className="ssm-card-header">
              <h4 className="card-title">{selected.employeeName}</h4>
              {canEdit && selected.state !== "NO_ASSESSMENT" ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={issueSheet.isPending}
                  onClick={() => issueSheet.mutate(selected.employeeId)}
                >
                  {issueSheet.isPending ? "Se emite…" : "Reemite fișa"}
                </button>
              ) : null}
            </div>
            <p className="field-hint">
              {selected.jobPositionName ?? "Fără post"} · {COVERAGE_LABELS[selected.state]}
            </p>
            {issueSheet.isError ? <p className="feedback error">{errorMessage(issueSheet.error)}</p> : null}
            {actionError ? <p className="feedback error">{actionError}</p> : null}
            {sheetsQuery.isLoading ? <p className="field-hint">Se încarcă fișele…</p> : null}
            {!sheetsQuery.isLoading && !sheets.length ? (
              <p className="field-hint">Nu există fișe emise pentru acest angajat.</p>
            ) : null}

            <div className="ssm-history-list">
              {sheets.map((sheet) => (
                <div key={sheet.id} className="ssm-history-item ssm-history-item--stack">
                  <div>
                    <strong>
                      {sheet.riskAssessmentTitle ?? "Fără evaluare"} · v{sheet.riskAssessmentVersionNumber ?? "—"}
                    </strong>
                    <div className="field-hint">
                      {SSM_EXPOSURE_SHEET_TRIGGER_LABELS[sheet.trigger]} · emisă {formatRoDate(sheet.createdAt)} ·{" "}
                      {SSM_EXPOSURE_SHEET_STATUS_LABELS[sheet.status]}
                      {sheet.outdated ? " · evaluarea are o versiune mai nouă" : ""}
                    </div>
                    <div className="field-hint">
                      Lucrător: {sheet.employeeSignedAt ? `semnat ${formatRoDate(sheet.employeeSignedAt)}` : "nesemnat"} ·
                      Evaluator:{" "}
                      {sheet.assessorSignedAt
                        ? `${sheet.assessorName ?? ""} ${formatRoDate(sheet.assessorSignedAt)}`
                        : "nesemnat"}
                    </div>
                  </div>
                  <div className="ssm-inline-actions">
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() =>
                        download(ssmApi.getSignedExposureSheetPdfUrl(sheet.id), `fisa-expunere-${sheet.id}.pdf`)
                      }
                    >
                      PDF
                    </button>
                    {canApprove && sheet.status === "PENDING_SIGNATURE" && !sheet.assessorSignedAt ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setSigningSheetId(sheet.id);
                          setAssessorForm((prev) => ({ ...prev, signature: "" }));
                        }}
                      >
                        Semnează ca evaluator
                      </button>
                    ) : null}
                  </div>
                  {signingSheetId === sheet.id ? (
                    <form
                      className="form-stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        signAssessor.mutate(
                          {
                            sheetId: sheet.id,
                            payload: {
                              assessorName: assessorForm.assessorName.trim(),
                              assessorFunction: assessorForm.assessorFunction.trim() || undefined,
                              signature: assessorForm.signature
                            }
                          },
                          { onSuccess: () => setSigningSheetId(null) }
                        );
                      }}
                    >
                      <div className="field">
                        <label htmlFor={`assessor-name-${sheet.id}`}>Nume evaluator / responsabil SSM</label>
                        <input
                          id={`assessor-name-${sheet.id}`}
                          value={assessorForm.assessorName}
                          onChange={(event) => setAssessorForm((prev) => ({ ...prev, assessorName: event.target.value }))}
                          required
                          minLength={3}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`assessor-function-${sheet.id}`}>Funcția</label>
                        <input
                          id={`assessor-function-${sheet.id}`}
                          value={assessorForm.assessorFunction}
                          onChange={(event) =>
                            setAssessorForm((prev) => ({ ...prev, assessorFunction: event.target.value }))
                          }
                          placeholder="ex. Inspector SSM"
                        />
                      </div>
                      <SignatureCanvas
                        value={assessorForm.signature}
                        onChange={(signature) => setAssessorForm((prev) => ({ ...prev, signature }))}
                        label="Semnătura evaluatorului"
                      />
                      <div className="ssm-inline-actions">
                        <button
                          className="btn-primary"
                          type="submit"
                          disabled={signAssessor.isPending || !assessorForm.signature.startsWith("data:image")}
                        >
                          {signAssessor.isPending ? "Se semnează…" : "Confirmă semnătura"}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setSigningSheetId(null)}>
                          Renunță
                        </button>
                      </div>
                      {signAssessor.isError ? (
                        <p className="feedback error">{errorMessage(signAssessor.error)}</p>
                      ) : null}
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-text"
              onClick={() =>
                download(ssmApi.getExposureSheetPdfUrl(selected.employeeId), `fisa-expunere-${selected.employeeId}.pdf`)
              }
            >
              Previzualizare fișă din evaluarea curentă (nesemnată)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
