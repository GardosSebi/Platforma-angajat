import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authStore } from "../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../shared/auth/clear-user-query-cache";
import { canAccessTenantAdmin } from "../shared/auth/roles";
import { useAuthSession } from "../shared/auth/use-auth-session";

const navBase = [
  { to: "/ssm", label: "SSM" },
  { to: "/chatbot", label: "Chatbot" },
  { to: "/surveys", label: "Surveys" },
  { to: "/ticketing", label: "Ticketing" },
  { to: "/informatii", label: "Informații" }
] as const;

export function AppLayout() {
  const session = useAuthSession();
  const navigate = useNavigate();

  const nav = [
    navBase[0],
    ...(canAccessTenantAdmin(session) ? ([{ to: "/master-data", label: "Master Data" }] as const) : []),
    ...navBase.slice(1)
  ];

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
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                end={to === "/ssm" || to === "/informatii"}
              >
                {label}
              </NavLink>
            ))}
            {canAccessTenantAdmin(session) ? (
              <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Admin
              </NavLink>
            ) : null}
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
                    clearUserScopedQueryCache();
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
