import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import type { SsmSectionId } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
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
import { SsmCssmManager } from "../components/SsmCssmManager";
import { SsmSubstancesManager } from "../components/SsmSubstancesManager";
import { SsmConventionsManager } from "../components/SsmConventionsManager";
import { DEFAULT_SSM_SECTION, ssmSectionPath, visibleSsmSections } from "../ssm-sections";

function renderSection(section: SsmSectionId) {
  switch (section) {
    case "documents":
      return <SsmDocumentsManager />;
    case "substances":
      return <SsmSubstancesManager />;
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
    case "cssm":
      return <SsmCssmManager />;
    case "conventions":
      return <SsmConventionsManager />;
    case "reports":
      return <SsmReportsManager />;
    case "compliance":
    default:
      return <SsmComplianceDashboardManager />;
  }
}

export function SsmDashboardPage() {
  const session = useAuthSession();
  const { section: sectionParam } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();

  if (!session) {
    return (
      <div className="callout-warn" role="status">
        Nu ești autentificat. <Link to="/login">Autentifică-te</Link>.
      </div>
    );
  }

  const legacySection = searchParams.get("section");
  if (!sectionParam && legacySection) {
    return <Navigate to={ssmSectionPath(legacySection as SsmSectionId)} replace />;
  }

  const sections = visibleSsmSections(session.roles);
  const active = sections.find((section) => section.id === sectionParam);

  if (!active) {
    const fallback = sections.find((section) => section.id === DEFAULT_SSM_SECTION) ?? sections[0];
    if (!fallback) {
      return (
        <div className="callout-warn" role="status">
          Rolul tău nu are acces la niciun modul SSM.
        </div>
      );
    }
    return <Navigate to={ssmSectionPath(fallback.id)} replace />;
  }

  return (
    <section className="ssm-active-section">
      <header className="ssm-active-section-header">
        <h1 className="page-title">{active.label}</h1>
        <p className="page-lead">{active.description}</p>
      </header>
      <div className="ssm-dashboard-grid">{renderSection(active.id)}</div>
    </section>
  );
}
