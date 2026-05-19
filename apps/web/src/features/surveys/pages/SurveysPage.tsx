import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import type {
  CreateSurveyRequest,
  SurveyAudienceType,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType
} from "@repo/shared-types/surveys";
import { downloadWithAuth } from "../../../shared/api/http-download";
import {
  useDepartmentsLookup,
  useEmployeeOptions,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { surveysApi } from "../api/surveys.api";
import {
  useActivateSurvey,
  useCloseSurvey,
  useCreatePublicSurveyLink,
  useCreateSurvey,
  useSurveyStats,
  useRespondedSurveyIds,
  useSurveys,
  useSurveysOverview
} from "../hooks/useSurveys";

const QUESTION_TYPES: SurveyQuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SCALE", "TEXT", "LONG_TEXT", "DATE", "BOOLEAN"];
const AUDIENCE_TYPES: SurveyAudienceType[] = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE", "CUSTOM"];

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: "Alegere unică",
  MULTIPLE_CHOICE: "Alegere multiplă",
  SCALE: "Scală",
  TEXT: "Text scurt",
  LONG_TEXT: "Text lung",
  DATE: "Dată",
  BOOLEAN: "Da / Nu"
};

const SURVEY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ciornă",
  ACTIVE: "Activ",
  CLOSED: "Închis",
  ARCHIVED: "Arhivat"
};

const AUDIENCE_LABELS: Record<SurveyAudienceType, string> = {
  ALL: "Toți angajații",
  WORKSITE: "Punct de lucru",
  DEPARTMENT: "Departament",
  JOB_POSITION: "Post",
  EMPLOYEE_GROUP: "Grup angajați",
  EMPLOYEE: "Angajat",
  CUSTOM: "Listă personalizată"
};

type SurveyForm = Omit<CreateSurveyRequest, "questionSchema" | "conditionalLogic" | "targetEmployeeIds"> & {
  targetEmployeeIdsCsv: string;
};

type QuestionForm = Omit<SurveyQuestion, "options"> & {
  options: SurveyQuestionOption[];
};

const EMPTY_SURVEY: SurveyForm = {
  title: "Sondaj satisfacție angajați",
  description: "Chestionar scurt pentru feedback intern.",
  audienceType: "ALL",
  audienceRefId: "",
  audienceLabel: "",
  targetEmployeeIdsCsv: "",
  privateLinkEnabled: true
};

const EMPTY_QUESTION: QuestionForm = {
  id: "q1",
  type: "SINGLE_CHOICE",
  title: "Cum evaluezi experiența în platformă?",
  required: true,
  options: [
    { value: "Foarte bine", label: "Foarte bine" },
    { value: "Bine", label: "Bine" },
    { value: "Necesită îmbunătățiri", label: "Necesită îmbunătățiri" }
  ],
  min: 1,
  max: 5
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function cleanOptions(options: SurveyQuestionOption[]) {
  return options
    .map((option) => option.label.trim())
    .filter(Boolean)
    .map((label) => ({ value: label, label }));
}

function canOpenSurveyToComplete(roles: string[] | undefined): boolean {
  return hasPermission(roles, "surveys:respond") || hasPermission(roles, "surveys:edit");
}

function questionNeedsOptions(type: SurveyQuestionType): boolean {
  return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}

export function SurveysPage() {
  const navigate = useNavigate();
  const session = useAuthSession();
  const surveysPage = usePagination();
  const overviewQuery = useSurveysOverview();
  const surveysQuery = useSurveys(surveysPage.params);
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const jobPositionsLookup = useJobPositionsLookup();
  const employeesOptions = useEmployeeOptions();

  const createSurvey = useCreateSurvey();
  const activateSurvey = useActivateSurvey();
  const closeSurvey = useCloseSurvey();
  const createPublicLink = useCreatePublicSurveyLink();

  const surveysPaged = paginationFromResult(surveysQuery.data, surveysPage.page, surveysPage.pageSize);
  const surveys = surveysPaged.items;
  const [surveyForm, setSurveyForm] = useState<SurveyForm>(EMPTY_SURVEY);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(EMPTY_QUESTION);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [publicExpiresAt, setPublicExpiresAt] = useState("");
  const [publicResponseLimit, setPublicResponseLimit] = useState("100");
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [openingSurveyId, setOpeningSurveyId] = useState<string | null>(null);

  const statsQuery = useSurveyStats(selectedSurveyId);
  const canComplete = canOpenSurveyToComplete(session?.roles);
  const respondedIdsQuery = useRespondedSurveyIds(canComplete);
  const respondedSurveyIds = respondedIdsQuery.data ?? new Set<string>();
  const kpi = overviewQuery.data?.kpi;
  const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
  const currentQuestionOptions = cleanOptions(questionForm.options);
  const currentQuestionReady =
    questionForm.title.trim().length > 0 && (!questionNeedsOptions(questionForm.type) || currentQuestionOptions.length > 0);
  const canSaveSurvey = questions.length > 0 || currentQuestionReady;

  useEffect(() => {
    if (!selectedSurveyId && surveys.length > 0) {
      setSelectedSurveyId(surveys[0].id);
    }
  }, [selectedSurveyId, surveys]);

  const audienceOptions = useMemo(() => {
    if (surveyForm.audienceType === "WORKSITE") {
      return (worksitesLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "DEPARTMENT") {
      return (departmentsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "JOB_POSITION") {
      return (jobPositionsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "EMPLOYEE") {
      return (employeesOptions.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.fullName} - ${item.email}` }));
    }
    return [];
  }, [
    departmentsLookup.data?.items,
    employeesOptions.data?.items,
    jobPositionsLookup.data?.items,
    surveyForm.audienceType,
    worksitesLookup.data?.items
  ]);

  const addQuestion = () => {
    setFormError(null);
    if (!currentQuestionReady) {
      setFormError("Completează întrebarea și, dacă este cazul, opțiunile.");
      return;
    }
    setQuestions((prev) => [...prev, buildQuestionFromForm(prev.length + 1)]);
    setQuestionForm((prev) => ({ ...prev, id: `q${questions.length + 2}`, title: "" }));
  };

  const updateQuestionOption = (index: number, label: string) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => (optionIndex === index ? { value: label, label } : option))
    }));
  };

  const addQuestionOption = () => {
    setQuestionForm((prev) => ({ ...prev, options: [...prev.options, { value: "", label: "" }] }));
  };

  const removeQuestionOption = (index: number) => {
    setQuestionForm((prev) => ({ ...prev, options: prev.options.filter((_, optionIndex) => optionIndex !== index) }));
  };

  const buildQuestionFromForm = (position: number): SurveyQuestion => ({
    id: `q${position}`,
    title: questionForm.title.trim(),
    type: questionForm.type,
    required: questionForm.required,
    options: questionNeedsOptions(questionForm.type) ? cleanOptions(questionForm.options) : undefined,
    min: questionForm.type === "SCALE" ? questionForm.min : undefined,
    max: questionForm.type === "SCALE" ? questionForm.max : undefined
  });

  const onAudienceRefChange = (value: string) => {
    const option = audienceOptions.find((item) => item.id === value);
    setSurveyForm((prev) => ({ ...prev, audienceRefId: value, audienceLabel: option?.label ?? "" }));
  };

  const onSurveySubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!canSaveSurvey) {
      setFormError("Adaugă cel puțin o întrebare pentru a salva sondajul.");
      return;
    }
    const questionSchema = questions.length > 0 ? questions : [buildQuestionFromForm(1)];
    const payload: CreateSurveyRequest = {
      title: surveyForm.title,
      description: surveyForm.description || undefined,
      audienceType: surveyForm.audienceType,
      audienceRefId: surveyForm.audienceRefId || undefined,
      audienceLabel: surveyForm.audienceLabel || undefined,
      targetEmployeeIds:
        surveyForm.audienceType === "CUSTOM"
          ? surveyForm.targetEmployeeIdsCsv.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      questionSchema,
      privateLinkEnabled: surveyForm.privateLinkEnabled
    };
    createSurvey.mutate(payload, {
      onSuccess: (created) => {
        setSelectedSurveyId(created.id);
        setQuestions([]);
        setQuestionForm(EMPTY_QUESTION);
        setFormError(null);
      }
    });
  };

  const openSurveyForRespond = useCallback(
    async (surveyId: string) => {
      const survey = surveys.find((item) => item.id === surveyId);
      if (!survey) {
        setFormError("Selectați un sondaj din listă.");
        return;
      }
      if (respondedSurveyIds.has(surveyId)) {
        setFormError("Ați completat deja acest sondaj.");
        return;
      }
      if (survey.status === "CLOSED" || survey.status === "ARCHIVED") {
        setFormError("Sondajul este închis sau arhivat și nu mai poate fi completat.");
        return;
      }
      setFormError(null);
      setOpeningSurveyId(surveyId);
      try {
        if (survey.status === "DRAFT") {
          await activateSurvey.mutateAsync(surveyId);
        }
        navigate(`/surveys/respond/${surveyId}`);
      } catch (error) {
        setFormError(mutationErrorMessage(error));
      } finally {
        setOpeningSurveyId(null);
      }
    },
    [surveys, respondedSurveyIds, activateSurvey, navigate]
  );

  const generatePublicLink = () => {
    if (!selectedSurveyId || !publicExpiresAt) {
      setFormError("Selectează un sondaj și completează expirarea pentru linkul public.");
      return;
    }
    createPublicLink.mutate({
      id: selectedSurveyId,
      payload: {
        expiresAt: publicExpiresAt,
        responseLimit: publicResponseLimit ? Number(publicResponseLimit) : undefined
      }
    });
  };

  const download = async (type: "json" | "xlsx" | "pdf") => {
    if (!selectedSurveyId) return;
    setDownloadError(null);
    try {
      await downloadWithAuth(surveysApi.getExportUrl(selectedSurveyId, type), `survey-${selectedSurveyId}.${type === "xlsx" ? "xls" : type}`);
    } catch (error) {
      setDownloadError(mutationErrorMessage(error));
    }
  };

  return (
    <>
      <h1 className="page-title">Sondaje</h1>
      <p className="page-lead">Partea M · 4.3: editor chestionar, link privat/public securizat, colectare răspunsuri și export.</p>

      <section className="ssm-documents" aria-labelledby="surveys-title">
        <div className="ssm-module-hero">
          <div className="card ssm-hero-card">
            <p className="ssm-card-eyebrow">Partea M · 4.3</p>
            <h2 id="surveys-title" className="card-title">
              Sondaje angajați
            </h2>
            <p className="ssm-hero-lead">
              Creează chestionare, distribuie întâi prin link privat autentificat, apoi public cu token, expirare și limită de răspunsuri.
            </p>
            <div className="ssm-badge-row">
              <span className="ssm-chip">Editor întrebări</span>
              <span className="ssm-chip">Link privat</span>
              <span className="ssm-chip">Export JSON/Excel/PDF</span>
            </div>
          </div>

          <div className="ssm-summary-strip">
            <div className="ssm-stat-card">
              <span>Active</span>
              <strong>{kpi?.activeSurveys ?? "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Răspunsuri</span>
              <strong>{kpi?.totalResponses ?? "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Linkuri publice</span>
              <strong>{kpi?.publicLinks ?? "-"}</strong>
            </div>
          </div>
        </div>

        <div className="survey-workspace">
          <form className="card form-stack ssm-doc-card survey-builder-card survey-builder-layout" onSubmit={onSurveySubmit}>
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Editor chestionar</h3>
                <p className="field-hint">Completează pașii de mai jos și salvează sondajul.</p>
              </div>
              <span className="ssm-chip">{questions.length} întrebări</span>
            </div>

            <div className="survey-builder-scroll">
            <div className="survey-section">
              <div className="survey-section-title">
                <span>1</span>
                <div>
                  <strong>Date sondaj</strong>
                  <p>Completează titlul, descrierea și cine primește sondajul.</p>
                </div>
              </div>
              <div className="ssm-form-grid">
                <div className="field wide">
                  <label htmlFor="survey-title">Titlu</label>
                  <input id="survey-title" value={surveyForm.title} onChange={(event) => setSurveyForm((prev) => ({ ...prev, title: event.target.value }))} required />
                </div>
                <div className="field wide">
                  <label htmlFor="survey-description">Descriere</label>
                  <textarea
                    id="survey-description"
                    value={surveyForm.description ?? ""}
                    onChange={(event) => setSurveyForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="survey-audience">Destinatari</label>
                  <select
                    id="survey-audience"
                    value={surveyForm.audienceType}
                    onChange={(event) =>
                      setSurveyForm((prev) => ({ ...prev, audienceType: event.target.value as SurveyAudienceType, audienceRefId: "", audienceLabel: "" }))
                    }
                  >
                    {AUDIENCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {AUDIENCE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                {audienceOptions.length > 0 ? (
                  <div className="field">
                    <label htmlFor="survey-audience-ref">Segment</label>
                    <select id="survey-audience-ref" value={surveyForm.audienceRefId ?? ""} onChange={(event) => onAudienceRefChange(event.target.value)}>
                      <option value="">Selectează segmentul</option>
                      {audienceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {surveyForm.audienceType === "CUSTOM" ? (
                  <div className="field wide">
                    <label htmlFor="survey-custom-employees">ID-uri angajați</label>
                    <textarea
                      id="survey-custom-employees"
                      value={surveyForm.targetEmployeeIdsCsv}
                      onChange={(event) => setSurveyForm((prev) => ({ ...prev, targetEmployeeIdsCsv: event.target.value }))}
                      placeholder="idAngajat1, idAngajat2"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="survey-section survey-question-builder">
              <div className="survey-section-title">
                <span>2</span>
                <div>
                  <strong>Întrebări</strong>
                  <p>Scrie întrebarea, alege tipul și salvează direct sau adaugă mai multe întrebări.</p>
                </div>
              </div>
              <div className="ssm-form-grid">
                <div className="field">
                  <label htmlFor="question-type">Tip întrebare</label>
                  <select
                    id="question-type"
                    value={questionForm.type}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, type: event.target.value as SurveyQuestionType }))}
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field wide">
                  <label htmlFor="question-title">Întrebare</label>
                  <input id="question-title" value={questionForm.title} onChange={(event) => setQuestionForm((prev) => ({ ...prev, title: event.target.value }))} />
                </div>
                {questionNeedsOptions(questionForm.type) ? (
                  <div className="field wide">
                    <span className="field-label">Opțiuni de răspuns</span>
                    <div className="survey-option-list">
                      {questionForm.options.map((option, index) => (
                        <div className="survey-option-row" key={`option-${index}`}>
                          <input
                            aria-label={`Opțiunea ${index + 1}`}
                            value={option.label}
                            onChange={(event) => updateQuestionOption(index, event.target.value)}
                            placeholder={`Opțiunea ${index + 1}`}
                          />
                          <button type="button" className="btn-secondary" onClick={() => removeQuestionOption(index)}>
                            Șterge
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn-secondary survey-add-option" onClick={addQuestionOption}>
                      Adaugă opțiune de răspuns
                    </button>
                    <p className="field-hint">Adaugă câte variante de răspuns ai nevoie. Opțiunile goale nu se salvează.</p>
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn-secondary survey-add-question" onClick={addQuestion} disabled={!currentQuestionReady}>
                Adaugă încă o întrebare
              </button>
              <div className="ssm-doc-items survey-question-list">
                {questions.map((question) => (
                  <article key={question.id} className="ssm-doc-item survey-question-item">
                    <strong>
                      {question.id} · {question.title}
                    </strong>
                    <span>{QUESTION_TYPE_LABELS[question.type]}</span>
                  </article>
                ))}
                {questions.length === 0 ? (
                  <p className="field-hint">Poți salva direct cu întrebarea completată acum sau poți adăuga mai multe întrebări.</p>
                ) : null}
              </div>
            </div>
            </div>

            <div className="survey-save-bar">
              <div>
                <strong>Finalizează chestionarul</strong>
                <span>
                  {canSaveSurvey
                    ? questions.length > 0
                      ? `${questions.length} întrebări pregătite pentru salvare.`
                      : "Sondajul va fi salvat cu întrebarea completată acum."
                    : "Completează întrebarea pentru a putea salva."}
                </span>
              </div>
              <button className="btn-primary" type="submit" disabled={createSurvey.isPending || !canSaveSurvey}>
                {createSurvey.isPending ? "Se salvează..." : "Salvează sondaj"}
              </button>
            </div>
            {formError ? <div className="feedback error">{formError}</div> : null}
            {createSurvey.isSuccess ? (
              <p className="feedback success" role="status">
                Sondaj salvat. Din lista din dreapta apasă <strong>Completează</strong> sau „Activează și completează”.
              </p>
            ) : null}
            {createSurvey.isError ? <div className="feedback error">{mutationErrorMessage(createSurvey.error)}</div> : null}
          </form>

          <div className="card ssm-doc-card survey-side-panel">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Sondaje create</h3>
                <p className="field-hint">Activează, închide și selectează pentru statistici/export.</p>
              </div>
              <span className="ssm-chip">{surveysPaged.total} total</span>
            </div>
            <div className="ssm-doc-items">
              {surveys.map((survey) => (
                <button
                  key={survey.id}
                  type="button"
                  className={`ssm-doc-item ${selectedSurveyId === survey.id ? "selected" : ""}`}
                  onClick={() => setSelectedSurveyId(survey.id)}
                >
                  <strong>{survey.title}</strong>
                  <span>
                    {SURVEY_STATUS_LABELS[survey.status]} · {survey.stats.questionCount} întrebări · {survey.stats.responseCount} răspunsuri
                  </span>
                  <div className="ssm-badge-row">
                    <span className={`ssm-chip ${survey.status === "ACTIVE" ? "good" : "warn"}`}>{AUDIENCE_LABELS[survey.audienceType]}</span>
                    {canComplete && !respondedSurveyIds.has(survey.id) ? (
                      <button
                        type="button"
                        className="ssm-chip survey-list-complete-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openSurveyForRespond(survey.id);
                        }}
                      >
                        Completează
                      </button>
                    ) : null}
                    {canComplete && respondedSurveyIds.has(survey.id) ? (
                      <span className="ssm-chip good">Completat</span>
                    ) : null}
                  </div>
                </button>
              ))}
              {!surveysQuery.isLoading && surveys.length === 0 ? <p className="field-hint">Nu există sondaje încă.</p> : null}
            </div>
            <PaginationBar
              page={surveysPaged.page}
              pageSize={surveysPaged.pageSize}
              total={surveysPaged.total}
              totalPages={surveysPaged.totalPages}
              onPageChange={surveysPage.setPage}
              onPageSizeChange={surveysPage.setPageSize}
              disabled={surveysQuery.isFetching}
            />
          </div>
        </div>

        <div className="survey-bottom-grid">
          <div className="card ssm-doc-card survey-action-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Distribuire și securitate</h3>
                <p className="field-hint">Privat primul; public doar cu token, expirare și limită.</p>
              </div>
              {selectedSurvey ? <span className="ssm-chip good">{selectedSurvey.title}</span> : null}
            </div>
            {!selectedSurvey ? (
              <div className="callout-warn" role="status">
                Creează sau selectează un sondaj din lista de mai sus pentru a activa distribuirea și exporturile.
              </div>
            ) : null}
            <div className="ssm-inline-actions">
              {canComplete && selectedSurvey && respondedSurveyIds.has(selectedSurvey.id) ? (
                <span className="ssm-chip good" role="status">
                  Ați completat deja acest sondaj
                </span>
              ) : null}
              {canComplete && (!selectedSurvey || !respondedSurveyIds.has(selectedSurvey.id)) ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedSurvey || openingSurveyId !== null}
                  onClick={() => selectedSurvey && void openSurveyForRespond(selectedSurvey.id)}
                >
                  {openingSurveyId === selectedSurvey?.id
                    ? "Se pregătește…"
                    : selectedSurvey?.status === "DRAFT"
                      ? "Activează și completează"
                      : "Deschide și completează"}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => selectedSurveyId && activateSurvey.mutate(selectedSurveyId)}>
                Activează
              </button>
              <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => selectedSurveyId && closeSurvey.mutate(selectedSurveyId)}>
                Închide
              </button>
            </div>
            <div className="ssm-form-grid">
              <div className="field">
                <label htmlFor="public-expires">Expirare link public</label>
                <input
                  id="public-expires"
                  type="datetime-local"
                  value={publicExpiresAt}
                  onChange={(event) => setPublicExpiresAt(event.target.value)}
                  disabled={!selectedSurvey}
                />
              </div>
              <div className="field">
                <label htmlFor="public-limit">Limită răspunsuri</label>
                <input
                  id="public-limit"
                  type="number"
                  min="1"
                  value={publicResponseLimit}
                  onChange={(event) => setPublicResponseLimit(event.target.value)}
                  disabled={!selectedSurvey}
                />
              </div>
            </div>
            <button type="button" className="btn-primary" disabled={!selectedSurvey || !publicExpiresAt || createPublicLink.isPending} onClick={generatePublicLink}>
              Generează link public
            </button>
            {createPublicLink.isSuccess ? (
              <div className="feedback success">
                Link public (copiază în browser):{" "}
                <code>
                  {typeof window !== "undefined" ? `${window.location.origin}${createPublicLink.data.url}` : createPublicLink.data.url}
                </code>
              </div>
            ) : null}
            {createPublicLink.isError ? <div className="feedback error">{mutationErrorMessage(createPublicLink.error)}</div> : null}
            {selectedSurvey ? (
              <p className="field-hint">
                Link privat (autentificare obligatorie):{" "}
                <code>
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/surveys/respond/${selectedSurvey.id}`
                    : `/surveys/respond/${selectedSurvey.id}`}
                </code>
              </p>
            ) : null}
          </div>

          <div className="card ssm-doc-card survey-action-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Statistici și export</h3>
                <p className="field-hint">Agregări pe întrebări și exporturi JSON/Excel/PDF.</p>
              </div>
              {selectedSurvey ? <span className="ssm-chip good">{selectedSurvey.stats.responseCount} răspunsuri</span> : null}
              <div className="ssm-inline-actions">
                <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => void download("json")}>
                  JSON
                </button>
                <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => void download("xlsx")}>
                  Excel
                </button>
                <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => void download("pdf")}>
                  PDF
                </button>
              </div>
            </div>
            {downloadError ? <div className="feedback error">{downloadError}</div> : null}
            <div className="ssm-doc-items">
              {(statsQuery.data?.questionStats ?? []).map((item) => (
                <article key={item.questionId} className="ssm-doc-item">
                  <strong>{item.title}</strong>
                  <span>
                    {item.type} · {item.responseCount} răspunsuri {item.average !== null && item.average !== undefined ? `· medie ${item.average}` : ""}
                  </span>
                  {item.options?.length ? (
                    <div className="ssm-badge-row">
                      {item.options.map((option) => (
                        <span key={option.value} className="ssm-chip">
                          {option.label}: {option.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {!selectedSurveyId ? <p className="field-hint">Selectează un sondaj pentru statistici.</p> : null}
              {selectedSurveyId && !statsQuery.isLoading && (statsQuery.data?.questionStats.length ?? 0) === 0 ? (
                <p className="field-hint">Nu există statistici încă.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
