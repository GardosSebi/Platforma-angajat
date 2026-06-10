import { Navigate } from "react-router-dom";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { getAppHomePath } from "../shared/auth/roles";

export function HomeRedirect() {
  const session = useAuthSession();
  return <Navigate to={getAppHomePath(session)} replace />;
}
