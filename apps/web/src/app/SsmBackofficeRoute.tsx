import { Navigate } from "react-router-dom";
import { SsmDashboardPage } from "../features/ssm/pages/SsmDashboardPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { hasSsmBackofficeAccess, isEmployeePortalUser } from "../shared/auth/roles";

export function SsmBackofficeRoute() {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to="/portal" replace />;
  }
  if (!hasSsmBackofficeAccess(session)) {
    return <Navigate to="/portal" replace />;
  }
  return <SsmDashboardPage />;
}
