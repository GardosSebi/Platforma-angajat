import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { SsmDashboardPage } from "../features/ssm/pages/SsmDashboardPage";
import { SsmGatePage } from "../features/ssm/pages/SsmGatePage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import {
  getAppHomePath,
  hasSsmBackofficeAccess,
  isEmployeePortalUser,
  isItmInspectorUser
} from "../shared/auth/roles";

function SsmGuard({ children }: { children: ReactNode }) {
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
  return <>{children}</>;
}

export function SsmBackofficeRoute() {
  return (
    <SsmGuard>
      <SsmDashboardPage />
    </SsmGuard>
  );
}

export function SsmGateRoute() {
  return (
    <SsmGuard>
      <SsmGatePage />
    </SsmGuard>
  );
}
