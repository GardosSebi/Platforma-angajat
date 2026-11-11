import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, matchPath, NavLink, useLocation } from "react-router-dom";
import { LocaleSwitcher } from "../shared/components/LocaleSwitcher";
import { NotificationBell } from "../shared/components/NotificationBell";
import { NavIcons } from "./nav-icons";

export type SidebarNavChild = {
  to: string;
  label: string;
};

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  children?: SidebarNavChild[];
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
                {group.items.map((item) =>
                  item.children?.length ? (
                    <SidebarNavParent key={item.to} item={item} onNavigate={() => onMobileOpenChange(false)} />
                  ) : (
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
                  )
                )}
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

function splitTo(to: string): { path: string; params: URLSearchParams } {
  const [path, query = ""] = to.split("?");
  return { path, params: new URLSearchParams(query) };
}

/** Children sharing a path (e.g. `/portal?tab=…`) are told apart by the query keys used among them. */
function isQueryChildActive(
  child: SidebarNavChild,
  siblings: SidebarNavChild[],
  pathname: string,
  search: string
): boolean {
  const { path, params } = splitTo(child.to);
  if (!matchPath({ path, end: true }, pathname)) return false;
  const keys = new Set(
    siblings.filter((s) => splitTo(s.to).path === path).flatMap((s) => [...splitTo(s.to).params.keys()])
  );
  const current = new URLSearchParams(search);
  return [...keys].every((key) => params.get(key) === current.get(key));
}

function SidebarNavParent({ item, onNavigate }: { item: SidebarNavItem; onNavigate: () => void }) {
  const location = useLocation();
  const children = item.children ?? [];
  const queryRouted = children.some((child) => child.to.includes("?"));
  const isWithin = children.some((child) =>
    matchPath({ path: splitTo(child.to).path, end: false }, location.pathname)
  );
  const [expanded, setExpanded] = useState(isWithin);
  const submenuId = useId();

  useEffect(() => {
    if (isWithin) setExpanded(true);
  }, [isWithin]);

  return (
    <li>
      <button
        type="button"
        className={`app-sidebar-link app-sidebar-parent${isWithin ? " active" : ""}`}
        aria-expanded={expanded}
        aria-controls={submenuId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="app-sidebar-link-icon">{item.icon}</span>
        <span className="app-sidebar-link-label">{item.label}</span>
        <span className={`app-sidebar-chevron${expanded ? " open" : ""}`} aria-hidden />
      </button>
      {expanded ? (
        <ul id={submenuId} className="app-sidebar-sublist">
          {children.map((child) => {
            const content = <span className="app-sidebar-sublink-label">{child.label}</span>;
            if (queryRouted) {
              const active = isQueryChildActive(child, children, location.pathname, location.search);
              return (
                <li key={child.to}>
                  <Link
                    to={child.to}
                    className={`app-sidebar-sublink${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {content}
                  </Link>
                </li>
              );
            }
            return (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  className={({ isActive }) => `app-sidebar-sublink${isActive ? " active" : ""}`}
                  onClick={onNavigate}
                >
                  {content}
                </NavLink>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
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
