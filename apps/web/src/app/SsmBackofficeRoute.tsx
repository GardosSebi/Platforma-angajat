import { Navigate, Outlet } from "react-router-dom";
import { useAuthSession } from "../shared/auth/use-auth-session";
import {
  getAppHomePath,
  hasSsmBackofficeAccess,
  isEmployeePortalUser,
  isItmInspectorUser
} from "../shared/auth/roles";

export function SsmBackofficeRoute() {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to="/portal" replace />;
  }
  if (isItmInspectorUser(session)) {
    return <Navigate to="/itm" replace />;
  }
  if (!hasSsmBackofficeAccess(session)) {
    return <Navigate to={getAppHomePath(session)} replace />;
  }
  return <Outlet />;
}
