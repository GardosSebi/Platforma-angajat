import { useEffect } from "react";
import type { SurveyAnswerValue } from "@repo/shared-types/surveys";
import { Link, useNavigate, useParams } from "react-router-dom";
import { surveysApi } from "../api/surveys.api";
import { SurveyFormFiller } from "../components/SurveyFormFiller";
import { useSurveyForRespond } from "../hooks/useSurveys";
import { useAuthSession } from "../../../shared/auth/use-auth-session";

export function SurveyRespondPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const session = useAuthSession();

  useEffect(() => {
    if (!surveyId) return;
    if (!session) {
      const returnUrl = `/surveys/respond/${surveyId}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [surveyId, session, navigate]);

  const query = useSurveyForRespond(surveyId, Boolean(session && surveyId));

  if (!surveyId) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card card">
          <p className="feedback error">Identificator sondaj lipsă.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card card">
          <p className="field-hint">Redirecționare către autentificare…</p>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card card">
          <p className="field-hint">Se încarcă sondajul…</p>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card card">
          <h1 className="card-title">Nu puteți completa acest sondaj</h1>
          <p className="feedback error" role="alert">
            {query.error instanceof Error ? query.error.message : "Eroare la încărcare."}
          </p>
          <p className="field-hint">Verificați că sunteți autentificat cu tenant-ul corect, că sondajul este activ și că linkul privat este activat.</p>
          <Link to="/login" className="btn-text-link">
            Autentificare
          </Link>
        </div>
      </div>
    );
  }

  const survey = query.data;
  if (!survey) return null;

  const handleSubmit = async (answers: Record<string, SurveyAnswerValue>) => {
    await surveysApi.submitResponse(surveyId, { answers });
  };

  return (
    <div className="survey-fill-page">
      <div className="survey-fill-card survey-fill-card--wide">
        <div className="survey-fill-brand">
          <span className="app-brand-mark" aria-hidden>
            EP
          </span>
          <span className="survey-fill-brand-text">Sondaj (cont autentificat)</span>
        </div>
        <SurveyFormFiller
          title={survey.title}
          description={survey.description}
          questions={survey.questionSchema}
          conditionalLogic={survey.conditionalLogic}
          onSubmit={handleSubmit}
        />
        <p className="survey-fill-footer-hint">
          <Link to="/">Înapoi la platformă</Link>
        </p>
      </div>
    </div>
  );
}
