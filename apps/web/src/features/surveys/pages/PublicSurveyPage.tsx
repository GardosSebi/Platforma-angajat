import type { SurveyAnswerValue } from "@repo/shared-types/surveys";
import { Link, useParams } from "react-router-dom";
import { submitPublicSurveyResponse } from "../api/surveys.api";
import { SurveyFormFiller } from "../components/SurveyFormFiller";
import { usePublicSurveyQuery } from "../hooks/useSurveys";

export function PublicSurveyPage() {
  const { token } = useParams<{ token: string }>();
  const query = usePublicSurveyQuery(token);

  if (!token) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card card">
          <p className="feedback error">Link invalid.</p>
          <Link to="/login" className="btn-text-link">
            Autentificare
          </Link>
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
          <h1 className="card-title">Sondaj indisponibil</h1>
          <p className="feedback error" role="alert">
            {query.error instanceof Error ? query.error.message : "Nu s-a putut încărca sondajul."}
          </p>
          <p className="field-hint">Linkul poate fi expirat, dezactivat sau incorect.</p>
        </div>
      </div>
    );
  }

  const survey = query.data;
  if (!survey) return null;

  const handleSubmit = async (answers: Record<string, SurveyAnswerValue>) => {
    await submitPublicSurveyResponse(token, { answers });
  };

  return (
    <div className="survey-fill-page">
      <div className="survey-fill-card survey-fill-card--wide">
        <div className="survey-fill-brand">
          <span className="app-brand-mark" aria-hidden>
            EP
          </span>
          <span className="survey-fill-brand-text">Sondaj (link public)</span>
        </div>
        <SurveyFormFiller
          title={survey.title}
          description={survey.description}
          questions={survey.questionSchema}
          conditionalLogic={survey.conditionalLogic}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
