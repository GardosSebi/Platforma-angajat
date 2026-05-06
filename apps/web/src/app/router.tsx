import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { SsmDashboardPage } from "../features/ssm/pages/SsmDashboardPage";

function Placeholder({ title }: { title: string }) {
  return <h2>{title} module - coming soon</h2>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/ssm">SSM</Link>
        <Link to="/chatbot">Chatbot</Link>
        <Link to="/surveys">Surveys</Link>
        <Link to="/ticketing">Ticketing</Link>
      </nav>
      <Routes>
        <Route path="/ssm" element={<SsmDashboardPage />} />
        <Route path="/chatbot" element={<Placeholder title="Chatbot" />} />
        <Route path="/surveys" element={<Placeholder title="Surveys" />} />
        <Route path="/ticketing" element={<Placeholder title="Ticketing" />} />
        <Route path="*" element={<SsmDashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
