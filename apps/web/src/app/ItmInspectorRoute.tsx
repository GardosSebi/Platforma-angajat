import { Navigate } from "react-router-dom";
import { ItmInspectorPage } from "../features/itm/pages/ItmInspectorPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { hasSsmBackofficeAccess, isEmployeePortalUser, isItmInspectorUser, getAppHomePath } from "../shared/auth/roles";

export function ItmInspectorRoute() {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to="/portal" replace />;
  }
  if (hasSsmBackofficeAccess(session)) {
    return <Navigate to="/ssm" replace />;
  }
  if (!isItmInspectorUser(session)) {
    return <Navigate to={getAppHomePath(session)} replace />;
  }
  return <ItmInspectorPage />;
}
