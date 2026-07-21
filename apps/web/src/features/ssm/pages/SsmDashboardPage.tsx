import { useMemo } from "react";
import { Link } from "react-router-dom";
import { canAccessSsmSection } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { SSM_SECTIONS } from "../ssm-sections";

export function SsmDashboardPage() {
  const session = useAuthSession();

  const visibleSections = useMemo(
    () => SSM_SECTIONS.filter((section) => canAccessSsmSection(session?.roles, section.id)),
    [session?.roles]
  );

  return (
    <>
      <h1 className="page-title">SSM</h1>
      <p className="page-lead">
        Alege un modul din listă sau din meniul lateral. Fiecare zonă are propria pagină, ca să fie mai ușor de
        urmărit.
      </p>
      {!session ? (
        <div className="callout-warn" role="status">
          You are not signed in. SSM actions need a JWT and tenant.{" "}
          <Link to="/login">Sign in</Link> (use tenant <code>e01</code> after running the API seed).
        </div>
      ) : null}

      <section className="ssm-overview-card" aria-label="Module SSM">
        <div className="ssm-overview-header">
          <h2 className="card-title">Module SSM</h2>
          <p className="field-hint">Sunt afișate doar modulele permise de rolul contului tău.</p>
        </div>
        <div className="ssm-hub-grid">
          {visibleSections.map((section) => (
            <Link key={section.id} to={section.path} className="ssm-hub-card">
              <strong>{section.title}</strong>
              <span>{section.caption}</span>
            </Link>
          ))}
        </div>
        {!visibleSections.length ? (
          <p className="field-hint">Nu ai acces la niciun modul SSM pentru acest cont.</p>
        ) : null}
      </section>
    </>
  );
}
