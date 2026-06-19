import { useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authStore, SESSION_EXPIRED_FLAG_KEY } from "../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../shared/auth/clear-user-query-cache";
import {
  canAccessTenantAdmin,
  canAccessEmployeePortal,
  hasSsmBackofficeAccess,
  isEmployeePortalUser,
  isItmInspectorUser
} from "../shared/auth/roles";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { AppSidebar, AppTopbar, type SidebarNavGroup } from "./AppSidebar";
import { NavIcons } from "./nav-icons";

const ROUTE_TITLES: Record<string, string> = {
  "/portal": "Spațiul meu",
  "/ssm": "SSM",
  "/master-data": "Master Data",
  "/chatbot": "Comunicări",
  "/surveys": "Sondaje",
  "/ticketing": "Ticketing",
  "/admin": "Administrare",
  "/itm": "Control ITM/ISU",
  "/informatii": "Informații",
  "/notificari": "Notificări"
};

function buildNavGroups(session: NonNullable<ReturnType<typeof useAuthSession>>): SidebarNavGroup[] {
  const isEmployee = isEmployeePortalUser(session);
  const isItm = isItmInspectorUser(session);
  const hasBackoffice = hasSsmBackofficeAccess(session);
  const showPortal = canAccessEmployeePortal(session);
  const isAdmin = canAccessTenantAdmin(session);

  if (isEmployee) {
    return [
      {
        title: "Portal angajat",
        items: [
          { to: "/portal", label: "Spațiul meu", icon: NavIcons.home(), end: true },
          { to: "/informatii", label: "Informații", icon: NavIcons.info(), end: true }
        ]
      }
    ];
  }

  if (isItm) {
    return [
      {
        title: "Inspector ITM",
        items: [
          { to: "/itm", label: "Control ITM/ISU", icon: NavIcons.itm(), end: true },
          { to: "/informatii", label: "Informații", icon: NavIcons.info(), end: true }
        ]
      }
    ];
  }

  const groups: SidebarNavGroup[] = [];

  if (showPortal) {
    groups.push({
      title: "Angajat",
      items: [{ to: "/portal", label: "Spațiul meu", icon: NavIcons.home(), end: true }]
    });
  }

  const operations: SidebarNavGroup["items"] = [];
  if (hasBackoffice) {
    operations.push({ to: "/ssm", label: "SSM", icon: NavIcons.ssm(), end: true });
  }
  if (isAdmin) {
    operations.push({ to: "/master-data", label: "Master Data", icon: NavIcons.masterData() });
  }
  if (operations.length) {
    groups.push({ title: "Operațiuni", items: operations });
  }

  if (hasBackoffice) {
    groups.push({
      title: "Comunicare & suport",
      items: [
        { to: "/chatbot", label: "Comunicări", icon: NavIcons.communications() },
        { to: "/surveys", label: "Sondaje", icon: NavIcons.surveys() },
        { to: "/ticketing", label: "Ticketing", icon: NavIcons.ticketing() }
      ]
    });
  }

  groups.push({
    title: "Resurse",
    items: [{ to: "/informatii", label: "Informații", icon: NavIcons.info(), end: true }]
  });

  if (isAdmin) {
    groups.push({
      title: "Sistem",
      items: [{ to: "/admin", label: "Administrare", icon: NavIcons.admin() }]
    });
  }

  return groups;
}

export function AppLayout() {
  const session = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const base = location.pathname.split("/").filter(Boolean)[0];
    if (!base) return undefined;
    const path = `/${base}`;
    return ROUTE_TITLES[path];
  }, [location.pathname]);

  if (!session) {
    const expired = sessionStorage.getItem(SESSION_EXPIRED_FLAG_KEY) === "1";
    if (expired) {
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
    }
    const params = new URLSearchParams({
      returnUrl: `${location.pathname}${location.search}`
    });
    if (expired) {
      params.set("expired", "1");
    }
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  const navGroups = buildNavGroups(session);

  const onSignOut = () => {
    clearUserScopedQueryCache();
    authStore.clear();
    navigate("/login");
  };

  return (
    <div className="app-shell app-shell--sidebar">
      <AppSidebar
        groups={navGroups}
        tenantId={session.tenantId}
        onSignOut={onSignOut}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="app-body">
        <AppTopbar onMenuClick={() => setMobileOpen(true)} title={pageTitle} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
