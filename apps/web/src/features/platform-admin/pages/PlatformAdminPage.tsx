import { useState } from "react";
import { ItmAccessPanel } from "../components/ItmAccessPanel";
import { ScopedRolesPanel } from "../components/ScopedRolesPanel";
import { StaticPagesPanel } from "../components/StaticPagesPanel";
import { PLATFORM_ADMIN_TABS, type PlatformAdminTab } from "../platform-admin-shared";

export function PlatformAdminPage() {
  const [tab, setTab] = useState<PlatformAdminTab>("scoped-roles");

  return (
    <div className="comms-page platform-admin-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Administrare platformă</h1>
          <p className="page-lead">
            Gestionează roluri scoped, acces inspector ITM și paginile statice vizibile angajaților.
          </p>
        </div>
      </header>

      <nav className="comms-tabs" aria-label="Secțiuni administrare">
        {PLATFORM_ADMIN_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "scoped-roles" ? <ScopedRolesPanel /> : null}
      {tab === "itm-access" ? <ItmAccessPanel /> : null}
      {tab === "static-pages" ? <StaticPagesPanel /> : null}
    </div>
  );
}
