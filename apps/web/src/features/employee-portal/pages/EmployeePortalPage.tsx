import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NavIcons } from "../../../app/nav-icons";
import { EmployeeAnnouncementsPanel } from "../components/EmployeeAnnouncementsPanel";
import { EmployeeDocumentsPanel } from "../components/EmployeeDocumentsPanel";
import { EmployeeDossierPanel } from "../components/EmployeeDossierPanel";
import { EmployeePortalHome } from "../components/EmployeePortalHome";
import { EmployeeSurveysPanel } from "../components/EmployeeSurveysPanel";
import { EmployeeTicketsPanel } from "../components/EmployeeTicketsPanel";
import { EmployeeTrainingsPanel } from "../components/EmployeeTrainingsPanel";
import type { EmployeePortalTab } from "../utils";
import { PORTAL_TAB_LABELS } from "../utils";

const TABS: EmployeePortalTab[] = [
  "home",
  "trainings",
  "documents",
  "dossier",
  "announcements",
  "surveys",
  "tickets"
];

const TAB_ICONS: Record<EmployeePortalTab, () => ReturnType<typeof NavIcons.home>> = {
  home: NavIcons.home,
  trainings: NavIcons.trainings,
  documents: NavIcons.documents,
  dossier: NavIcons.dossier,
  announcements: NavIcons.announcements,
  surveys: NavIcons.surveys,
  tickets: NavIcons.tickets
};

function parseTab(value: string | null): EmployeePortalTab {
  if (value && TABS.includes(value as EmployeePortalTab)) {
    return value as EmployeePortalTab;
  }
  return "home";
}

export function EmployeePortalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<EmployeePortalTab>(() => parseTab(searchParams.get("tab")));

  useEffect(() => {
    const parsed = parseTab(searchParams.get("tab"));
    setTab((current) => (current === parsed ? current : parsed));
  }, [searchParams]);

  const setActiveTab = (next: EmployeePortalTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "home") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setSearchParams(params, { replace: true });
  };

  const panel = useMemo(() => {
    switch (tab) {
      case "trainings":
        return <EmployeeTrainingsPanel />;
      case "documents":
        return <EmployeeDocumentsPanel />;
      case "dossier":
        return <EmployeeDossierPanel />;
      case "announcements":
        return <EmployeeAnnouncementsPanel />;
      case "surveys":
        return <EmployeeSurveysPanel />;
      case "tickets":
        return <EmployeeTicketsPanel />;
      case "home":
      default:
        return <EmployeePortalHome onNavigate={setActiveTab} />;
    }
  }, [tab]);

  return (
    <div className="employee-portal page-stack">
      <header className="page-header">
        <h1 className="page-title">{PORTAL_TAB_LABELS[tab]}</h1>
        <p className="page-lead">
          {tab === "home"
            ? "Rezumatul activităților tale: instruiri, sondaje și solicitări."
            : "Instruiri SSM, documente, anunțuri și solicitări interne — tot ce ai nevoie ca angajat."}
        </p>
      </header>

      <div className="employee-portal-layout">
        <nav className="employee-portal-nav" aria-label="Secțiuni portal angajat">
          {TABS.map((id) => {
            const Icon = TAB_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                className={`employee-portal-nav-link${tab === id ? " active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="employee-portal-nav-icon">{Icon()}</span>
                {PORTAL_TAB_LABELS[id]}
              </button>
            );
          })}
        </nav>

        <nav className="employee-portal-tabs" aria-label="Secțiuni portal angajat (mobil)">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              onClick={() => setActiveTab(id)}
            >
              {PORTAL_TAB_LABELS[id]}
            </button>
          ))}
        </nav>

        <div className="employee-portal-content employee-portal-panel">{panel}</div>
      </div>
    </div>
  );
}
