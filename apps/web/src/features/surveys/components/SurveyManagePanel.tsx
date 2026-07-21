import type { SurveyItem, SurveyQuestionStats } from "@repo/shared-types/surveys";
import { SURVEY_QUESTION_TYPE_LABELS } from "@repo/shared-types/surveys";
import { AUDIENCE_LABELS, SURVEY_STATUS_LABELS, formatSurveyDate } from "../surveys-shared";

type Props = {
  survey: SurveyItem | undefined;
  stats: SurveyQuestionStats[] | undefined;
  statsLoading: boolean;
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

export function SurveyManagePanel({
  survey,
  stats,
  statsLoading,
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

        <fieldset className="comms-fieldset">
          <legend>Linkuri de distribuire</legend>
          <p className="field-hint">
            Link privat (autentificare): <code>{privateLink}</code>
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
              <label htmlFor="public-limit">Limită răspunsuri</label>
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
    </div>
  );
}
