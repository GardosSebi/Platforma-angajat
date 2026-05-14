import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { AppLayout } from "./AppLayout";
import { SsmDashboardPage } from "../features/ssm/pages/SsmDashboardPage";
import { MasterDataPage } from "../features/master-data/pages/MasterDataPage";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { canAccessTenantAdmin } from "../shared/auth/roles";
import { ChatbotPage } from "../features/chatbot/pages/ChatbotPage";
import { SurveysPage } from "../features/surveys/pages/SurveysPage";
import { PublicSurveyPage } from "../features/surveys/pages/PublicSurveyPage";
import { SurveyRespondPage } from "../features/surveys/pages/SurveyRespondPage";
import { TicketingPage } from "../features/ticketing/pages/TicketingPage";
import { AdminPage } from "../features/platform-admin/pages/AdminPage";
import { EmployeeStaticListPage } from "../features/employee-static/pages/EmployeeStaticListPage";
import { EmployeeStaticDetailPage } from "../features/employee-static/pages/EmployeeStaticDetailPage";

function MasterDataRoute() {
  const session = useAuthSession();
  if (!canAccessTenantAdmin(session)) {
    return <Navigate to="/ssm" replace />;
  }
  return <MasterDataPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/surveys/public/:token" element={<PublicSurveyPage />} />
        <Route path="/surveys/respond/:surveyId" element={<SurveyRespondPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/ssm" replace />} />
          <Route path="/ssm" element={<SsmDashboardPage />} />
          <Route path="/master-data" element={<MasterDataRoute />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/surveys" element={<SurveysPage />} />
          <Route path="/ticketing" element={<TicketingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/informatii" element={<EmployeeStaticListPage />} />
          <Route path="/informatii/:slug" element={<EmployeeStaticDetailPage />} />
          <Route path="*" element={<Navigate to="/ssm" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
