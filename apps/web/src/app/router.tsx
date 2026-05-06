import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { AppLayout } from "./AppLayout";
import { SsmDashboardPage } from "../features/ssm/pages/SsmDashboardPage";

function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon" aria-hidden>
        {icon}
      </div>
      <h2>{title}</h2>
      <p>This module is not wired up yet. You will see tools and workflows here in a later iteration.</p>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/ssm" replace />} />
          <Route path="/ssm" element={<SsmDashboardPage />} />
          <Route path="/chatbot" element={<Placeholder title="Chatbot" icon="💬" />} />
          <Route path="/surveys" element={<Placeholder title="Surveys" icon="📋" />} />
          <Route path="/ticketing" element={<Placeholder title="Ticketing" icon="🎫" />} />
          <Route path="*" element={<Navigate to="/ssm" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
