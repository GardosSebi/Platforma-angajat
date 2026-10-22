import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SSM_EXPOSURE_SHEET_STATUS_LABELS,
  SSM_EXPOSURE_SHEET_TRIGGER_LABELS,
  type SsmExposureSheetItem
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { ssmApi } from "../../ssm/api/ssm.api";
import { formatRoDate, mutationErrorMessage } from "../utils";

type Props = {
  employeeId: string;
  sheets: SsmExposureSheetItem[];
};

export function EmployeeExposureSheetsSection({ employeeId, sheets }: Props) {
  const queryClient = useQueryClient();
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = useMutation({
    mutationFn: (sheetId: string) => ssmApi.signExposureEmployee(sheetId, { signature }),
    onSuccess: async () => {
      setSigningId(null);
      setSignature("");
      setAcknowledged(false);
      await queryClient.invalidateQueries({ queryKey: ["employee-portal", "dossier", employeeId] });
    },
    onError: (err: unknown) => setError(mutationErrorMessage(err))
  });

  const current = sheets.filter((sheet) => sheet.status !== "SUPERSEDED");
  const archived = sheets.filter((sheet) => sheet.status === "SUPERSEDED");

  return (
    <section className="card employee-dossier-section">
      <h3 className="card-title">Fișa de expunere la riscuri a postului</h3>
      <p className="field-hint">
        Fișa este emisă la angajare și la fiecare revizie a evaluării de risc pentru postul tău. Citește riscurile și
        măsurile, apoi semnează pentru luare la cunoștință.
      </p>
      {error ? <p className="feedback error">{error}</p> : null}
      {!current.length ? <p className="field-hint">Nu există o fișă emisă pentru postul tău.</p> : null}

      {current.map((sheet) => {
        const needsEmployeeSignature = !sheet.employeeSignedAt;
        return (
          <article key={sheet.id} className="ssm-exposure-sheet">
            <header className="ssm-exposure-sheet__head">
              <strong>{sheet.jobPositionName ?? "Post nespecificat"}</strong>
              <span className={sheet.status === "SIGNED" ? "ssm-chip good" : "ssm-chip warn"}>
                {SSM_EXPOSURE_SHEET_STATUS_LABELS[sheet.status]}
              </span>
            </header>
            <p className="field-hint">
              {sheet.riskAssessmentTitle
                ? `Evaluare de risc: ${sheet.riskAssessmentTitle} · v${sheet.riskAssessmentVersionNumber ?? 1}`
                : "Fără evaluare de risc activă"}
              {` · emisă ${formatRoDate(sheet.createdAt)} (${SSM_EXPOSURE_SHEET_TRIGGER_LABELS[sheet.trigger]})`}
            </p>

            {sheet.factors.length ? (
              <>
                <h4>Riscuri la care ești expus</h4>
                <ul className="ssm-exposure-sheet__list">
                  {sheet.factors.map((factor, index) => (
                    <li key={`${factor.name}-${index}`}>
                      {factor.name}
                      {factor.score != null ? <span className="field-hint"> · nivel {factor.score}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {sheet.measures.length ? (
              <>
                <h4>Măsuri de prevenire</h4>
                <ul className="ssm-exposure-sheet__list">
                  {sheet.measures.map((measure, index) => (
                    <li key={`${measure}-${index}`}>{measure}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {sheet.eipItems.length ? (
              <p>
                <strong>EIP obligatoriu:</strong> {sheet.eipItems.join(", ")}
              </p>
            ) : null}

            <p className="field-hint">
              {sheet.employeeSignedAt ? `Semnată de tine la ${formatRoDate(sheet.employeeSignedAt)}` : "Nesemnată de tine"}
              {" · "}
              {sheet.assessorSignedAt
                ? `semnată de evaluator (${sheet.assessorName ?? "—"}) la ${formatRoDate(sheet.assessorSignedAt)}`
                : "în așteptarea semnăturii evaluatorului"}
            </p>

            <div className="ssm-inline-actions">
              {needsEmployeeSignature && signingId !== sheet.id ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setError(null);
                    setSigningId(sheet.id);
                    setSignature("");
                    setAcknowledged(false);
                  }}
                >
                  Semnează fișa
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setError(null);
                  void downloadWithAuth(ssmApi.getSignedExposureSheetPdfUrl(sheet.id), `fisa-expunere-${sheet.id}.pdf`).catch(
                    (err: unknown) => setError(mutationErrorMessage(err))
                  );
                }}
              >
                Descarcă PDF
              </button>
            </div>

            {signingId === sheet.id ? (
              <div className="ssm-exposure-sheet__sign">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  Am luat la cunoștință riscurile postului, măsurile de prevenire și EIP-ul pe care trebuie să îl
                  utilizez.
                </label>
                <SignatureCanvas value={signature} onChange={setSignature} label="Semnătura ta" />
                <div className="ssm-inline-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!acknowledged || !signature.startsWith("data:image") || sign.isPending}
                    onClick={() => sign.mutate(sheet.id)}
                  >
                    {sign.isPending ? "Se semnează…" : "Confirmă semnătura"}
                  </button>
                  <button type="button" className="btn-text" onClick={() => setSigningId(null)}>
                    Renunță
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}

      {archived.length ? (
        <details className="ssm-exposure-sheet__archive">
          <summary>Fișe anterioare arhivate ({archived.length})</summary>
          <ul className="employee-dossier-list">
            {archived.map((sheet) => (
              <li key={sheet.id}>
                <strong>
                  {sheet.jobPositionName ?? "Post"} · v{sheet.riskAssessmentVersionNumber ?? "—"}
                </strong>
                <span>
                  emisă {formatRoDate(sheet.createdAt)}
                  {sheet.employeeSignedAt ? ` · semnată ${formatRoDate(sheet.employeeSignedAt)}` : " · nesemnată"}
                </span>
                {sheet.hasPdf ? (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      setError(null);
                      void downloadWithAuth(
                        ssmApi.getSignedExposureSheetPdfUrl(sheet.id),
                        `fisa-expunere-${sheet.id}.pdf`
                      ).catch((err: unknown) => setError(mutationErrorMessage(err)));
                    }}
                  >
                    PDF
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
