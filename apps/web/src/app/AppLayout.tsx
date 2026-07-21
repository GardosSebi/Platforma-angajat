import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PwaInstallBanner } from "../pwa/install-prompt";
import { authStore, SESSION_EXPIRED_FLAG_KEY } from "../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../shared/auth/clear-user-query-cache";
import {
  canAccessTenantAdmin,
  canAccessEmployeePortal,
  hasSsmBackofficeAccess,
  isEmployeePortalUser,
  isItmInspectorUser
} from "../shared/auth/roles";
import { canAccessSsmSection } from "../shared/auth/effective-permissions";
import { useAuthSession } from "../shared/auth/use-auth-session";
import { AppSidebar, AppTopbar, type SidebarNavGroup } from "./AppSidebar";
import { NavIcons } from "./nav-icons";
import { SSM_SECTIONS, getSsmSection } from "../features/ssm/ssm-sections";

function buildNavGroups(
  session: NonNullable<ReturnType<typeof useAuthSession>>,
  t: (key: string) => string
): SidebarNavGroup[] {
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
          { to: "/portal", label: t("nav.portal"), icon: NavIcons.home(), end: true },
          { to: "/informatii", label: t("nav.info"), icon: NavIcons.info(), end: true }
        ]
      }
    ];
  }

  if (isItm) {
    return [
      {
        title: "Inspector ITM",
        items: [
          { to: "/itm", label: t("nav.itm"), icon: NavIcons.itm(), end: true },
          { to: "/informatii", label: t("nav.info"), icon: NavIcons.info(), end: true }
        ]
      }
    ];
  }

  const groups: SidebarNavGroup[] = [];

  if (showPortal) {
    groups.push({
      title: "Angajat",
      items: [{ to: "/portal", label: t("nav.portal"), icon: NavIcons.home(), end: true }]
    });
  }

  if (hasBackoffice) {
    const ssmItems: SidebarNavGroup["items"] = [
      { to: "/ssm", label: t("nav.ssmOverview"), icon: NavIcons.ssm(), end: true }
    ];
    for (const section of SSM_SECTIONS) {
      if (!canAccessSsmSection(session.roles, section.id)) continue;
      ssmItems.push({
        to: section.path,
        label: section.navLabel,
        icon: NavIcons.ssm(),
        end: true
      });
    }
    groups.push({ title: t("nav.ssm"), items: ssmItems });
  }

  const operations: SidebarNavGroup["items"] = [];
  if (isAdmin) {
    operations.push({ to: "/master-data", label: t("nav.masterData"), icon: NavIcons.masterData() });
    operations.push({ to: "/platform-admin", label: t("nav.admin"), icon: NavIcons.info() });
  }
  if (operations.length) {
    groups.push({ title: "Operațiuni", items: operations });
  }

  if (hasBackoffice) {
    groups.push({
      title: "Comunicare & suport",
      items: [
        { to: "/chatbot", label: t("nav.communications"), icon: NavIcons.communications() },
        { to: "/surveys", label: t("nav.surveys"), icon: NavIcons.surveys() },
        { to: "/ticketing", label: t("nav.ticketing"), icon: NavIcons.ticketing() }
      ]
    });
  }

  groups.push({
    title: "Resurse",
    items: [{ to: "/informatii", label: t("nav.info"), icon: NavIcons.info(), end: true }]
  });

  return groups;
}

export function AppLayout() {
  const { t } = useTranslation();
  const session = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const base = parts[0];
    if (!base) return undefined;

    if (base === "ssm") {
      const section = getSsmSection(parts[1]);
      return section?.title ?? t("nav.ssm");
    }

    const titleByRoute: Record<string, string> = {
      portal: t("nav.portal"),
      "master-data": t("nav.masterData"),
      "platform-admin": t("nav.admin"),
      chatbot: t("nav.communications"),
      surveys: t("nav.surveys"),
      ticketing: t("nav.ticketing"),
      itm: t("nav.itm"),
      informatii: t("nav.info"),
      notificari: t("nav.notifications")
    };

    return titleByRoute[base];
  }, [location.pathname, t]);

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

  const navGroups = buildNavGroups(session, t);

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
          <PwaInstallBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
