import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authStore } from "../shared/auth/auth-store";
import { useAuthSession } from "../shared/auth/use-auth-session";

const nav = [
  { to: "/ssm", label: "SSM" },
  { to: "/chatbot", label: "Chatbot" },
  { to: "/surveys", label: "Surveys" },
  { to: "/ticketing", label: "Ticketing" }
];

export function AppLayout() {
  const session = useAuthSession();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <span className="app-brand-mark" aria-hidden>
              EP
            </span>
            <span>Employee Platform</span>
          </div>
          <nav className="app-nav" aria-label="Main">
            {nav.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : undefined)} end={to === "/ssm"}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="app-auth">
            {session ? (
              <>
                <span className="app-auth-tenant" title="Active tenant">
                  {session.tenantId}
                </span>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    authStore.clear();
                    navigate("/login");
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="btn-text-link">
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
