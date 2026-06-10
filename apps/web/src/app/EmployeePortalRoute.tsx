import { Navigate } from "react-router-dom";
import { EmployeePortalPage } from "../features/employee-portal/pages/EmployeePortalPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { canAccessEmployeePortal, getAppHomePath } from "../shared/auth/roles";

/** Portal angajat — accesibil tuturor utilizatorilor cu rol EMPLOYEE. */
export function EmployeePortalRoute() {
  const session = useAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!canAccessEmployeePortal(session)) {
    return <Navigate to={getAppHomePath(session)} replace />;
  }
  return <EmployeePortalPage />;
}
