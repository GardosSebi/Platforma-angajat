import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { TrainingAssignForm } from "../components/TrainingAssignForm";
import { SsmDocumentsManager } from "../components/SsmDocumentsManager";
import { SsmTrainingSuiteManager } from "../components/SsmTrainingSuiteManager";
import { SsmEipManager } from "../components/SsmEipManager";
import { SsmAccidentsManager } from "../components/SsmAccidentsManager";
import { SsmMedicalManager } from "../components/SsmMedicalManager";
import { SsmRiskManager } from "../components/SsmRiskManager";
import { SsmPsiManager } from "../components/SsmPsiManager";
import { SsmComplianceDashboardManager } from "../components/SsmComplianceDashboardManager";
import { SsmReportsManager } from "../components/SsmReportsManager";

type SsmSectionId =
  | "quick"
  | "documents"
  | "training"
  | "eip"
  | "accidents"
  | "medical"
  | "risk"
  | "psi"
  | "compliance"
  | "reports";

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
    caption: "Upload, versionare, istoric",
    description: "Gestionează unitar documentele, versiunile și accesul rapid pentru controale."
  },
  {
    id: "training",
    title: "Instruire și conformitate",
    caption: "Calendar, teste, fișe",
    description: "Configurează instruiri, finalizează testări și verifică starea de conformitate."
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
    caption: "Cazuri, task-uri, statistici",
    description: "Înregistrează cazuri și urmărește fluxul de cercetare până la închidere."
  },
  {
    id: "medical",
    title: "Medicina muncii",
    caption: "Aptitudini, fișe, reminder",
    description: "Configurează tipuri de controale medicale, rezultate și următoarele scadențe."
  },
  {
    id: "risk",
    title: "Evaluări risc + PPP",
    caption: "Factori, nivel risc, măsuri",
    description: "Versionează evaluări pe post, loc de muncă sau departament și păstrează motivul actualizării."
  },
  {
    id: "psi",
    title: "PSI / urgențe",
    caption: "Documentație, echipamente, instruiri",
    description: "Urmărește documentația PSI pe punct de lucru, scadențele echipamentelor și responsabilii."
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
  const activeSectionMeta = useMemo(
    () => SSM_SECTIONS.find((section) => section.id === activeSection) ?? SSM_SECTIONS[0],
    [activeSection]
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
      <p className="page-lead">Centru operațional SSM: navigare pe module, acțiuni rapide și fluxuri ușor de urmărit.</p>
      {!session ? (
        <div className="callout-warn" role="status">
          You are not signed in. SSM actions need a JWT and tenant.{" "}
          <Link to="/login">Sign in</Link> (use tenant <code>e01</code> after running the API seed).
        </div>
      ) : null}

      <section className="ssm-overview-card" aria-label="Navigare SSM">
        <div className="ssm-overview-header">
          <h2 className="card-title">Module SSM</h2>
          <p className="field-hint">Alege secțiunea în care lucrezi acum, fără să parcurgi toată pagina.</p>
        </div>
        <div className="ssm-overview-tabs" role="tablist" aria-label="Secțiuni SSM">
          {SSM_SECTIONS.map((section) => (
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
