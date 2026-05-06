import { Link } from "react-router-dom";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { TrainingAssignForm } from "../components/TrainingAssignForm";

export function SsmDashboardPage() {
  const session = useAuthSession();

  return (
    <>
      <h1 className="page-title">SSM</h1>
      <p className="page-lead">Health &amp; safety: assign mandatory training by employee and keep due dates under control.</p>
      {!session ? (
        <div className="callout-warn" role="status">
          You are not signed in. SSM actions need a JWT and tenant.{" "}
          <Link to="/login">Sign in</Link> (use tenant <code>e01</code> after running the API seed).
        </div>
      ) : null}
      <TrainingAssignForm />
    </>
  );
}
