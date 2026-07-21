import { useEffect, useMemo } from "react";
import type { SurveyAnswerValue } from "@repo/shared-types/surveys";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { surveysApi } from "../api/surveys.api";
import { SurveyFormFiller } from "../components/SurveyFormFiller";
import { SurveyThankYou } from "../components/SurveyThankYou";
import { useSurveyForRespond } from "../hooks/useSurveys";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { isEmployeePortalUser, requireLinkedEmployeeId } from "../../../shared/auth/roles";

export function SurveyRespondPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthSession();
  const isEmployee = isEmployeePortalUser(session);
  const linkedEmployeeId = requireLinkedEmployeeId(session);
  const surveysHome = isEmployee ? "/portal?tab=surveys" : "/surveys";

  useEffect(() => {
    if (!surveyId) return;
    if (!session) {
      const returnUrl = `/surveys/respond/${surveyId}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [surveyId, session, navigate]);

  const query = useSurveyForRespond(surveyId, Boolean(session && surveyId));

  const thanksFooter = useMemo(
    () => (
      <p className="survey-fill-footer-hint">
        <Link to={surveysHome}>Înapoi la sondaje</Link>
        {!isEmployee ? (
          <>
            {" · "}
            <Link to="/">Platformă</Link>
          </>
        ) : null}
      </p>
    ),
    [surveysHome, isEmployee]
  );

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
          <p className="field-hint">
            Verificați că sunteți autentificat pe tenant-ul corect, că sondajul este <strong>activ</strong>, că e-mailul
            contului corespunde fișei de angajat și că sondajul vă include în audiență.
          </p>
          <Link to={surveysHome} className="btn-text-link">
            Înapoi la sondaje
          </Link>
        </div>
      </div>
    );
  }

  const survey = query.data;
  if (!survey) return null;

  if (survey.alreadyResponded) {
    return (
      <div className="survey-fill-page">
        <div className="survey-fill-card survey-fill-card--wide">
          <div className="survey-fill-brand">
            <span className="app-brand-mark" aria-hidden>
              EP
            </span>
            <span className="survey-fill-brand-text">Sondaj (cont autentificat)</span>
          </div>
          <SurveyThankYou footer={thanksFooter} />
        </div>
      </div>
    );
  }

  const handleSubmit = async (answers: Record<string, SurveyAnswerValue>) => {
    await surveysApi.submitResponse(surveyId, {
      answers,
      employeeId: linkedEmployeeId ?? undefined
    });
    const userId = session?.userId;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["surveys", "responded-ids", userId] }),
      queryClient.invalidateQueries({ queryKey: ["surveys", "for-respond", userId, surveyId] }),
      queryClient.invalidateQueries({ queryKey: ["employee-portal", "surveys-available"] })
    ]);
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
        {!linkedEmployeeId && isEmployee ? (
          <p className="feedback error" role="alert">
            Contul nu este legat de un profil angajat. Contactați HR înainte de a trimite răspunsul.
          </p>
        ) : null}
        <SurveyFormFiller
          title={survey.title}
          description={survey.description}
          questions={survey.questionSchema}
          conditionalLogic={survey.conditionalLogic}
          onSubmit={handleSubmit}
          onUploadFile={async (file) => {
            const uploaded = await surveysApi.uploadAnswerFile(surveyId, file);
            return uploaded.answerValue;
          }}
          thanksFooter={thanksFooter}
        />
        <p className="survey-fill-footer-hint">
          <Link to={surveysHome}>Înapoi la sondaje</Link>
          {!isEmployee ? (
            <>
              {" · "}
              <Link to="/">Platformă</Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
