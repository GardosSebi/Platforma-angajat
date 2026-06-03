import { Navigate } from "react-router-dom";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { isEmployeePortalUser, isItmInspectorUser } from "../shared/auth/roles";

export function HomeRedirect() {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to="/portal" replace />;
  }
  if (isItmInspectorUser(session)) {
    return <Navigate to="/itm" replace />;
  }
  return <Navigate to="/ssm" replace />;
}
