import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LocaleSwitcher } from "../shared/components/LocaleSwitcher";
import { NotificationBell } from "../shared/components/NotificationBell";
import { NavIcons } from "./nav-icons";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

export type SidebarNavGroup = {
  title?: string;
  items: SidebarNavItem[];
};

type Props = {
  groups: SidebarNavGroup[];
  tenantId: string;
  onSignOut: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({ groups, tenantId, onSignOut, mobileOpen, onMobileOpenChange }: Props) {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileOpenChange]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-mobile-open", mobileOpen);
    return () => document.body.classList.remove("sidebar-mobile-open");
  }, [mobileOpen]);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Închide meniul"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside className={`app-sidebar ${mobileOpen ? "open" : ""}`} aria-label="Navigare principală">
        <div className="app-sidebar-head">
          <div className="app-brand">
            <span className="app-brand-mark" aria-hidden>
              EP
            </span>
            <div className="app-brand-text">
              <span className="app-brand-title">Platformă Angajați</span>
              <span className="app-brand-sub">SSM · HR · Comunicare</span>
            </div>
          </div>
          <button
            type="button"
            className="app-sidebar-close"
            aria-label="Închide meniul"
            onClick={() => onMobileOpenChange(false)}
          >
            {NavIcons.close()}
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {groups.map((group, groupIndex) => (
            <div key={group.title ?? `group-${groupIndex}`} className="app-sidebar-group">
              {group.title ? <p className="app-sidebar-group-title">{group.title}</p> : null}
              <ul className="app-sidebar-list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `app-sidebar-link${isActive ? " active" : ""}`}
                      onClick={() => onMobileOpenChange(false)}
                    >
                      <span className="app-sidebar-link-icon">{item.icon}</span>
                      <span className="app-sidebar-link-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="app-sidebar-foot">
          <div className="app-sidebar-user">
            <div className="app-sidebar-tenant" title="Tenant activ">
              <span className="app-sidebar-tenant-label">Organizație</span>
              <strong>{tenantId}</strong>
            </div>
            <NotificationBell />
          </div>
          <button type="button" className="app-sidebar-signout" onClick={onSignOut}>
            Deconectare
          </button>
        </div>
      </aside>
    </>
  );
}

export function AppTopbar({
  onMenuClick,
  title
}: {
  onMenuClick: () => void;
  title?: string;
}) {
  return (
    <header className="app-topbar">
      <button type="button" className="app-topbar-menu" aria-label="Deschide meniul" onClick={onMenuClick}>
        {NavIcons.menu()}
      </button>
      {title ? <h1 className="app-topbar-title">{title}</h1> : null}
      <div className="app-topbar-actions">
        <LocaleSwitcher />
      </div>
    </header>
  );
}
