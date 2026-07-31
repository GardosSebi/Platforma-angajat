import { useMemo, useState } from "react";
import type { SurveyAnswerValue, SurveyItem, SurveyQuestionStats, SurveyResponseListItem } from "@repo/shared-types/surveys";
import { localizeSurveyContent, SURVEY_QUESTION_TYPE_LABELS } from "@repo/shared-types/surveys";
import { AUDIENCE_LABELS, SURVEY_STATUS_LABELS, formatSurveyDate } from "../surveys-shared";
import { SurveyFormFiller } from "./SurveyFormFiller";

type Props = {
  survey: SurveyItem | undefined;
  stats: SurveyQuestionStats[] | undefined;
  statsLoading: boolean;
  responses: SurveyResponseListItem[] | undefined;
  responsesLoading: boolean;
  canComplete: boolean;
  responded: boolean;
  openingSurveyId: string | null;
  publicExpiresAt: string;
  publicResponseLimit: string;
  activatePending: boolean;
  closePending: boolean;
  publicLinkPending: boolean;
  publicLinkUrl: string | undefined;
  publicLinkError: string | null;
  downloadError: string | null;
  onComplete: () => void;
  onActivate: () => void;
  onClose: () => void;
  onPublicExpiresChange: (value: string) => void;
  onPublicLimitChange: (value: string) => void;
  onGeneratePublicLink: () => void;
  onDownload: (type: "json" | "xlsx" | "pdf") => void;
  onBackToList: () => void;
  onEdit?: () => void;
};

function formatAnswer(value: SurveyAnswerValue): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  return String(value);
}

export function SurveyManagePanel({
  survey,
  stats,
  statsLoading,
  responses,
  responsesLoading,
  canComplete,
  responded,
  openingSurveyId,
  publicExpiresAt,
  publicResponseLimit,
  activatePending,
  closePending,
  publicLinkPending,
  publicLinkUrl,
  publicLinkError,
  downloadError,
  onComplete,
  onActivate,
  onClose,
  onPublicExpiresChange,
  onPublicLimitChange,
  onGeneratePublicLink,
  onDownload,
  onBackToList,
  onEdit
}: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewLocale, setPreviewLocale] = useState("ro");
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);

  const localizedPreview = useMemo(() => {
    if (!survey) return null;
    return localizeSurveyContent(survey, previewLocale);
  }, [survey, previewLocale]);

  const localeOptions = useMemo(() => {
    const keys = new Set(["ro", ...(Object.keys(survey?.translations ?? {}))]);
    return Array.from(keys);
  }, [survey?.translations]);

  if (!survey) {
    return (
      <section className="card comms-panel">
        <div className="comms-empty-state">
          <h2 className="card-title">Gestionează sondaj</h2>
          <p className="field-hint">Selectează un sondaj din listă pentru distribuire, statistici și export.</p>
          <button type="button" className="btn-secondary" onClick={onBackToList}>
            Mergi la listă
          </button>
        </div>
      </section>
    );
  }

  const privateLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/surveys/respond/${survey.id}`
      : `/surveys/respond/${survey.id}`;

  const canRespond =
    canComplete && !responded && survey.status !== "CLOSED" && survey.status !== "ARCHIVED";
  const canEdit = Boolean(onEdit) && (survey.status === "DRAFT" || survey.status === "ACTIVE");

  return (
    <div className="survey-manage-stack">
      <section className="card comms-panel">
        <div className="comms-compose-head">
          <div>
            <h2 className="card-title">{survey.title}</h2>
            <p className="comms-toolbar-hint">
              {SURVEY_STATUS_LABELS[survey.status]} · {AUDIENCE_LABELS[survey.audienceType]} · actualizat{" "}
              {formatSurveyDate(survey.updatedAt)}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBackToList}>
            Înapoi la listă
          </button>
        </div>

        <div className="survey-manage-summary">
          <div>
            <span>Întrebări</span>
            <strong>{survey.stats.questionCount}</strong>
          </div>
          <div>
            <span>Răspunsuri</span>
            <strong>{survey.stats.responseCount}</strong>
          </div>
          <div>
            <span>Link public</span>
            <strong>{survey.publicEnabled ? "Activ" : "Inactiv"}</strong>
          </div>
        </div>

        <p className="field-hint">
          {survey.opensAt ? `Deschidere: ${formatSurveyDate(survey.opensAt)} · ` : null}
          {survey.closesAt ? `Închidere: ${formatSurveyDate(survey.closesAt)} · ` : null}
          {survey.responseLimit ? `Limită privat: ${survey.responseLimit}` : "Fără limită pe canal privat"}
        </p>

        <fieldset className="comms-fieldset">
          <legend>Acțiuni</legend>
          <div className="comms-inline-actions">
            {responded ? <span className="comms-status comms-status--good">Ați completat deja acest sondaj</span> : null}
            {canRespond ? (
              <button
                type="button"
                className="btn-primary"
                disabled={openingSurveyId === survey.id}
                onClick={onComplete}
              >
                {openingSurveyId === survey.id
                  ? "Se pregătește…"
                  : survey.status === "DRAFT"
                    ? "Activează și completează"
                    : "Deschide și completează"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowPreview((prev) => !prev);
                setPreviewLocale("ro");
              }}
            >
              {showPreview ? "Închide previzualizarea" : "Previzualizare (fără salvare)"}
            </button>
            {canEdit ? (
              <button type="button" className="btn-secondary" onClick={onEdit}>
                Editează sondaj
              </button>
            ) : null}
            <button type="button" className="btn-secondary" disabled={activatePending} onClick={onActivate}>
              {activatePending ? "Se activează…" : "Activează"}
            </button>
            <button type="button" className="btn-secondary" disabled={closePending} onClick={onClose}>
              {closePending ? "Se închide…" : "Închide sondaj"}
            </button>
          </div>
        </fieldset>

        {showPreview && localizedPreview ? (
          <div className="survey-preview-wrap">
            <SurveyFormFiller
              key={`${survey.id}-${previewLocale}-preview`}
              title={localizedPreview.title}
              description={localizedPreview.description}
              questions={localizedPreview.questions}
              conditionalLogic={survey.conditionalLogic}
              previewMode
              localeToggle={{
                available: localeOptions,
                value: previewLocale,
                onChange: setPreviewLocale
              }}
              onSubmit={async () => undefined}
            />
          </div>
        ) : null}

        <fieldset className="comms-fieldset">
          <legend>Linkuri de distribuire</legend>
          <p className="field-hint">
            Link privat (autentificare): <code>{privateLink}</code>
            {!survey.privateLinkEnabled ? " — dezactivat" : null}
          </p>
          <div className="comms-form-row">
            <div className="field">
              <label htmlFor="public-expires">Expirare link public</label>
              <input
                id="public-expires"
                type="datetime-local"
                value={publicExpiresAt}
                onChange={(event) => onPublicExpiresChange(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="public-limit">Limită răspunsuri publice</label>
              <input
                id="public-limit"
                type="number"
                min="1"
                value={publicResponseLimit}
                onChange={(event) => onPublicLimitChange(event.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!publicExpiresAt || publicLinkPending}
            onClick={onGeneratePublicLink}
          >
            {publicLinkPending ? "Se generează…" : "Generează link public"}
          </button>
          {publicLinkUrl ? (
            <div className="feedback success" role="status">
              Link public: <code>{publicLinkUrl}</code>
            </div>
          ) : null}
          {publicLinkError ? <div className="feedback error">{publicLinkError}</div> : null}
        </fieldset>
      </section>

      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Statistici și export</h2>
            <p className="comms-toolbar-hint">{survey.stats.responseCount} răspunsuri în total</p>
          </div>
          <div className="comms-inline-actions">
            <button type="button" className="btn-secondary btn-sm" onClick={() => onDownload("json")}>
              JSON
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onDownload("xlsx")}>
              Excel
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onDownload("pdf")}>
              PDF
            </button>
          </div>
        </div>

        {downloadError ? <div className="feedback error">{downloadError}</div> : null}

        {statsLoading ? <p className="field-hint">Se încarcă statisticile...</p> : null}
        {!statsLoading && (stats?.length ?? 0) === 0 ? (
          <p className="field-hint">Nu există răspunsuri încă pentru acest sondaj.</p>
        ) : null}
        {!statsLoading && stats && stats.length > 0 ? (
          <div className="survey-stats-list">
            {stats.map((item) => (
              <article key={item.questionId} className="survey-stat-item">
                <strong>{item.title}</strong>
                <span>
                  {SURVEY_QUESTION_TYPE_LABELS[item.type]} · {item.responseCount} răspunsuri
                  {item.average !== null && item.average !== undefined ? ` · medie ${item.average}` : ""}
                </span>
                {item.options?.length ? (
                  <div className="survey-stat-options">
                    {item.options.map((option) => (
                      <span key={option.value} className="comms-filter-chip">
                        {option.label}: {option.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Răspunsuri individuale</h2>
            <p className="comms-toolbar-hint">{responses?.length ?? 0} înregistrări (max. 500)</p>
          </div>
        </div>
        {responsesLoading ? <p className="field-hint">Se încarcă răspunsurile…</p> : null}
        {!responsesLoading && (responses?.length ?? 0) === 0 ? (
          <p className="field-hint">Niciun răspuns individual încă.</p>
        ) : null}
        {!responsesLoading && responses && responses.length > 0 ? (
          <div className="survey-stats-list">
            {responses.map((item) => {
              const expanded = expandedResponseId === item.id;
              return (
                <article key={item.id} className="survey-stat-item">
                  <div className="comms-inline-actions" style={{ justifyContent: "space-between", width: "100%" }}>
                    <div>
                      <strong>{formatSurveyDate(item.submittedAt)}</strong>
                      <span>
                        {" "}
                        · {item.channel === "PUBLIC" ? "Public" : "Privat"}
                        {item.employeeName ? ` · ${item.employeeName}` : survey.anonymousMode ? " · Anonim" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setExpandedResponseId(expanded ? null : item.id)}
                    >
                      {expanded ? "Ascunde" : "Detalii"}
                    </button>
                  </div>
                  {expanded ? (
                    <ul className="survey-question-preview">
                      {survey.questionSchema.map((question) => (
                        <li key={question.id}>
                          <strong>{question.title}</strong>
                          <span>{formatAnswer(item.answers[question.id])}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
