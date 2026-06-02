import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTrainingPlans } from "../../ssm/hooks/useSsmTrainingSuite";
import { employeeStaticApi } from "../../employee-static/api/employee-static.api";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { employeePortalApi } from "../api/employee-portal.api";
import type { EmployeePortalTab } from "../utils";
import { PORTAL_TAB_LABELS } from "../utils";

const QUICK_LINKS: Array<{ tab: EmployeePortalTab; hint: string }> = [
  { tab: "trainings", hint: "Parcurge instruiri și semnează fișele" },
  { tab: "documents", hint: "Documente SSM aplicabile postului tău" },
  { tab: "surveys", hint: "Sondaje active pentru tine" },
  { tab: "tickets", hint: "Cereri HR, concediu, IT" }
];

export function EmployeePortalHome({ onNavigate }: { onNavigate: (tab: EmployeePortalTab) => void }) {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const plansQuery = useTrainingPlans({ page: 1, pageSize: 50 });
  const surveysQuery = useQuery({
    queryKey: ["employee-portal", "surveys-available"],
    queryFn: employeePortalApi.listAvailableSurveys
  });
  const contextQuery = useQuery({
    queryKey: ["employee-static", "my-context"],
    queryFn: employeeStaticApi.getMyContext,
    enabled: Boolean(employeeId)
  });

  const plans = plansQuery.data?.items ?? [];
  const pending = plans.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
  const blocked = plans.some((p) => p.blockedAdmission);
  const openSurveys = (surveysQuery.data?.items ?? []).filter((s) => !s.alreadyResponded).length;

  return (
    <div className="employee-portal-home">
      {blocked ? (
        <div className="feedback error employee-portal-alert" role="alert">
          <strong>Atenție:</strong> ai instruiri nevalidate sau expirate. Reluarea activității poate fi restricționată
          până la finalizarea instruirilor SSM.
        </div>
      ) : null}

      <div className="employee-portal-kpi-grid">
        <div className="card employee-kpi-card">
          <span className="employee-kpi-label">Instruiri de parcurs</span>
          <strong className="employee-kpi-value">{pending.length}</strong>
        </div>
        <div className="card employee-kpi-card">
          <span className="employee-kpi-label">Sondaje deschise</span>
          <strong className="employee-kpi-value">{openSurveys}</strong>
        </div>
        <div className="card employee-kpi-card">
          <span className="employee-kpi-label">Instruiri finalizate</span>
          <strong className="employee-kpi-value">{plans.filter((p) => p.status === "COMPLETED").length}</strong>
        </div>
      </div>

      {contextQuery.data?.employee ? (
        <div className="card employee-welcome-card">
          <p>
            Bună ziua, <strong>{contextQuery.data.employee.fullName}</strong>
          </p>
          <p className="field-hint">
            {contextQuery.data.employee.department?.name ?? "—"} · {contextQuery.data.employee.jobPosition?.name ?? "—"}{" "}
            · {contextQuery.data.employee.worksite?.name ?? "—"}
          </p>
        </div>
      ) : !employeeId ? (
        <div className="card employee-welcome-card">
          <p className="feedback error">
            Contul nu este legat de un angajat. Solicită administratorului asocierea e-mailului{" "}
            <strong>{session?.tenantId ? "" : ""}</strong> cu fișa ta.
          </p>
        </div>
      ) : null}

      <h3 className="ssm-subtitle">Acces rapid</h3>
      <div className="employee-quick-links">
        {QUICK_LINKS.map(({ tab, hint }) => (
          <button key={tab} type="button" className="card employee-quick-link" onClick={() => onNavigate(tab)}>
            <strong>{PORTAL_TAB_LABELS[tab]}</strong>
            <span className="field-hint">{hint}</span>
          </button>
        ))}
        <Link to="/informatii" className="card employee-quick-link">
          <strong>Informații & echipă</strong>
          <span className="field-hint">Colegi, departament, pagini utile</span>
        </Link>
      </div>

      {pending.length ? (
        <div className="card">
          <h3 className="card-title">Următoarele instruiri</h3>
          <ul className="employee-dossier-list">
            {pending.slice(0, 5).map((plan) => (
              <li key={plan.id}>
                <strong>{plan.trainingTypeName}</strong>
                <span>
                  până la {new Date(plan.dueAt).toLocaleDateString("ro-RO")}
                  {plan.blockedAdmission ? " · blocare admitere" : ""}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-text-link" onClick={() => onNavigate("trainings")}>
            Vezi toate instruirile →
          </button>
        </div>
      ) : null}
    </div>
  );
}
