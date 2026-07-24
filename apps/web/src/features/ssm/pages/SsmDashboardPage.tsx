import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { canAccessSsmSection, type SsmSectionId } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { TrainingAssignForm } from "../components/TrainingAssignForm";
import { SsmDocumentsManager } from "../components/SsmDocumentsManager";
import { SsmTrainingSuiteManager } from "../components/SsmTrainingSuiteManager";
import { SsmEipManager } from "../components/SsmEipManager";
import { SsmAccidentsManager } from "../components/SsmAccidentsManager";
import { SsmMedicalManager } from "../components/SsmMedicalManager";
import { SsmRiskManager } from "../components/SsmRiskManager";
import { SsmPppManager } from "../components/SsmPppManager";
import { SsmPsiManager } from "../components/SsmPsiManager";
import { SsmComplianceDashboardManager } from "../components/SsmComplianceDashboardManager";
import { SsmReportsManager } from "../components/SsmReportsManager";

const SSM_SECTIONS: Array<{
  id: SsmSectionId;
  title: string;
  caption: string;
  description: string;
}> = [
  {
    id: "quick",
    title: "Acțiune rapidă",
    caption: "Alocare instruire",
    description: "Folosește această secțiune pentru alocări punctuale către angajați."
  },
  {
    id: "documents",
    title: "Documente SSM",
    caption: "Vizualizare / upload",
    description:
      "Documente aplicabile postului și istoricul versiunilor; angajații văd doar documentele relevante pentru ei."
  },
  {
    id: "training",
    title: "Instruire și conformitate",
    caption: "Calendar, teste, fișe",
    description:
      "Modul 3.3: tipuri legale, e-learning, teste, semnături, calendar scadențe, remindere și raport conformitate pe departament."
  },
  {
    id: "eip",
    title: "Echipamente EIP",
    caption: "Normative, mișcări, stoc",
    description: "Administrează tipurile EIP, normarea pe post și distribuțiile către personal."
  },
  {
    id: "accidents",
    title: "Accidente și incidente",
    caption: "Registru, cercetare, măsuri",
    description: "Lucrează pe secțiuni: registru cazuri, cercetare, măsuri corective și statistici."
  },
  {
    id: "medical",
    title: "Medicina muncii",
    caption: "Tipuri, registru, reminder",
    description: "Lucrează pe secțiuni: tipuri pe post, registru controale, actualizare rezultat/fișă și reminder-uri."
  },
  {
    id: "risk",
    title: "Evaluări risc",
    caption: "Listă, creare, versionare",
    description: "Lucrează pe secțiuni: listă evaluări, creare, versionare/PPP și fișă expunere PDF."
  },
  {
    id: "ppp",
    title: "Plan PPP",
    caption: "Măsuri, responsabili, termene",
    description: "Modul dedicat pentru planuri de prevenire și protecție cu măsuri urmărite individual."
  },
  {
    id: "psi",
    title: "PSI / urgențe",
    caption: "Documente, echipamente, instruiri",
    description:
      "Lucrează pe secțiuni: documentație structurată, echipamente/verificări/alerte, instruiri unificate, responsabili și exerciții."
  },
  {
    id: "compliance",
    title: "Calendar + conformitate",
    caption: "KPI, status, restanțe",
    description: "Calendar unificat și dashboard cu breakdown, top neconformități și drill-down restanțe."
  },
  {
    id: "reports",
    title: "Rapoarte & export",
    caption: "PDF, Excel, inspector",
    description: "Rapoarte pentru instruiri, EIP, medicina muncii și documente/versionare."
  }
];

export function SsmDashboardPage() {
  const session = useAuthSession();
  const [activeSection, setActiveSection] = useState<SsmSectionId>("quick");

  const visibleSections = useMemo(
    () => SSM_SECTIONS.filter((s) => canAccessSsmSection(session?.roles, s.id)),
    [session?.roles]
  );

  useEffect(() => {
    if (!session?.roles?.length) return;
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? "documents");
    }
  }, [session?.roles, visibleSections, activeSection]);

  const activeSectionMeta = useMemo(
    () => SSM_SECTIONS.find((section) => section.id === activeSection) ?? visibleSections[0] ?? SSM_SECTIONS[0],
    [activeSection, visibleSections]
  );

  const renderSection = () => {
    switch (activeSection) {
      case "documents":
        return <SsmDocumentsManager />;
      case "training":
        return <SsmTrainingSuiteManager />;
      case "eip":
        return <SsmEipManager />;
      case "accidents":
        return <SsmAccidentsManager />;
      case "medical":
        return <SsmMedicalManager />;
      case "risk":
        return <SsmRiskManager />;
      case "ppp":
        return <SsmPppManager />;
      case "psi":
        return <SsmPsiManager />;
      case "compliance":
        return <SsmComplianceDashboardManager />;
      case "reports":
        return <SsmReportsManager />;
      case "quick":
      default:
        return <TrainingAssignForm />;
    }
  };

  return (
    <>
      <h1 className="page-title">SSM</h1>
      {!session ? (
        <div className="callout-warn" role="status">
          You are not signed in. SSM actions need a JWT and tenant.{" "}
          <Link to="/login">Sign in</Link> (use tenant <code>e01</code> after running the API seed).
        </div>
      ) : null}

      <section className="ssm-overview-card" aria-label="Navigare SSM">
        <div className="ssm-overview-header">
          <h2 className="card-title">Module SSM</h2>
          <p className="field-hint">Sunt afișate doar modulele permise de rolul contului tău.</p>
        </div>
        <div className="ssm-overview-tabs" role="tablist" aria-label="Secțiuni SSM">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`ssm-overview-tab ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <strong>{section.title}</strong>
              <span>{section.caption}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ssm-active-section" aria-live="polite">
        <header className="ssm-active-section-header">
          <h2 className="card-title">{activeSectionMeta.title}</h2>
          <p className="field-hint">{activeSectionMeta.description}</p>
        </header>
        <div className="ssm-dashboard-grid">{renderSection()}</div>
      </section>
    </>
  );
}
