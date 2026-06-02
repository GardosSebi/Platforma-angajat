import { Navigate } from "react-router-dom";
import { EmployeePortalPage } from "../features/employee-portal/pages/EmployeePortalPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { isEmployeePortalUser } from "../shared/auth/roles";

/** Portal dedicat utilizatorilor cu rol EMPLOYEE (fără acces backoffice SSM). */
export function EmployeePortalRoute() {
  const session = useAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!isEmployeePortalUser(session)) {
    return <Navigate to="/ssm" replace />;
  }
  return <EmployeePortalPage />;
}
