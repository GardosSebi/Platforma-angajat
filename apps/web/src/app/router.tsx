import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { AppLayout } from "./AppLayout";
import { MasterDataPage } from "../features/master-data/pages/MasterDataPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { canAccessTenantAdmin, canAccessEmployeePortal, getAppHomePath, hasSsmBackofficeAccess, isEmployeePortalUser } from "../shared/auth/roles";
import { ChatbotPage } from "../features/chatbot/pages/ChatbotPage";
import { SurveysPage } from "../features/surveys/pages/SurveysPage";
import { PublicSurveyPage } from "../features/surveys/pages/PublicSurveyPage";
import { SurveyRespondPage } from "../features/surveys/pages/SurveyRespondPage";
import { TicketingPage } from "../features/ticketing/pages/TicketingPage";
import { AdminPage } from "../features/platform-admin/pages/AdminPage";
import { EmployeeStaticListPage } from "../features/employee-static/pages/EmployeeStaticListPage";
import { HomeRedirect } from "./HomeRedirect";
import { SsmBackofficeRoute } from "./SsmBackofficeRoute";
import { EmployeePortalRoute } from "./EmployeePortalRoute";
import { ItmInspectorRoute } from "./ItmInspectorRoute";
import { NotificationsPage } from "../features/notifications/pages/NotificationsPage";

function MasterDataRoute() {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to="/portal" replace />;
  }
  if (!canAccessTenantAdmin(session)) {
    return <Navigate to={getAppHomePath(session)} replace />;
  }
  return <MasterDataPage />;
}

function BackofficeOnlyRoute({ children, employeeRedirect }: { children: ReactNode; employeeRedirect: string }) {
  const session = useAuthSession();
  if (isEmployeePortalUser(session)) {
    return <Navigate to={employeeRedirect} replace />;
  }
  return <>{children}</>;
}

function AdminRoute() {
  const session = useAuthSession();
  if (!canAccessTenantAdmin(session)) {
    return <Navigate to={getAppHomePath(session)} replace />;
  }
  return <AdminPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/surveys/public/:token" element={<PublicSurveyPage />} />
        <Route path="/surveys/respond/:surveyId" element={<SurveyRespondPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/portal" element={<EmployeePortalRoute />} />
          <Route path="/itm" element={<ItmInspectorRoute />} />
          <Route path="/ssm" element={<SsmBackofficeRoute />} />
          <Route path="/master-data" element={<MasterDataRoute />} />
          <Route
            path="/chatbot"
            element={
              <BackofficeOnlyRoute employeeRedirect="/portal?tab=announcements">
                <ChatbotPage />
              </BackofficeOnlyRoute>
            }
          />
          <Route
            path="/surveys"
            element={
              <BackofficeOnlyRoute employeeRedirect="/portal?tab=surveys">
                <SurveysPage />
              </BackofficeOnlyRoute>
            }
          />
          <Route
            path="/ticketing"
            element={
              <BackofficeOnlyRoute employeeRedirect="/portal?tab=tickets">
                <TicketingPage />
              </BackofficeOnlyRoute>
            }
          />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/informatii" element={<EmployeeStaticListPage />} />
          <Route path="/notificari" element={<NotificationsPage />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
