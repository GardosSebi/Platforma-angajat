import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { employeePortalApi } from "../api/employee-portal.api";
import { mutationErrorMessage } from "../utils";

export function EmployeeSurveysPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);

  const query = useQuery({
    queryKey: ["employee-portal", "surveys-available"],
    queryFn: employeePortalApi.listAvailableSurveys,
    enabled: Boolean(employeeId)
  });

  const items = query.data?.items ?? [];

  if (!employeeId) {
    return (
      <div className="employee-portal-empty card">
        <p>Contul tău nu este legat de un profil de angajat.</p>
        <p className="field-hint">
          E-mailul de login trebuie să coincidă cu cel din fișa de personal ca să vezi și să completezi sondajele.
        </p>
      </div>
    );
  }

  if (query.isLoading) {
    return <p className="field-hint">Se încarcă sondajele…</p>;
  }

  if (query.isError) {
    return <p className="feedback error">{mutationErrorMessage(query.error)}</p>;
  }

  if (!items.length) {
    return (
      <div className="employee-portal-empty card">
        <p>Nu ai sondaje active de completat.</p>
        <p className="field-hint">
          Sondajele apar aici când sunt <strong>activate</strong> de administrator și te includ în audiență (toți
          angajații, departament, punct de lucru etc.).
        </p>
      </div>
    );
  }

  return (
    <ul className="employee-survey-list">
      {items.map((survey) => (
        <li key={survey.id} className="card employee-survey-item">
          <div>
            <strong>{survey.title}</strong>
            {survey.description ? <p className="field-hint">{survey.description}</p> : null}
          </div>
          {survey.alreadyResponded ? (
            <span className="ssm-chip good">Completat</span>
          ) : (
            <Link to={`/surveys/respond/${survey.id}`} className="btn-primary">
              Completează
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
