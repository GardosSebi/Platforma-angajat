import { Link, Navigate, useParams } from "react-router-dom";
import { canAccessSsmSection } from "../../../shared/auth/effective-permissions";
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
import { getSsmSection, type SsmSectionMeta } from "../ssm-sections";
import type { SsmSectionId } from "../../../shared/auth/effective-permissions";

function renderSection(sectionId: SsmSectionId) {
  switch (sectionId) {
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
}

function SsmSectionContent({ section }: { section: SsmSectionMeta }) {
  return (
    <>
      <nav className="ssm-section-breadcrumb" aria-label="Navigare SSM">
        <Link to="/ssm">SSM</Link>
        <span aria-hidden>/</span>
        <span>{section.title}</span>
      </nav>
      <header className="ssm-active-section-header">
        <h1 className="page-title">{section.title}</h1>
        <p className="page-lead">{section.description}</p>
      </header>
      <div className="ssm-dashboard-grid">{renderSection(section.id)}</div>
    </>
  );
}

export function SsmSectionPage() {
  const session = useAuthSession();
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = getSsmSection(sectionId);

  if (!section) {
    return <Navigate to="/ssm" replace />;
  }

  if (!canAccessSsmSection(session?.roles, section.id)) {
    return <Navigate to="/ssm" replace />;
  }

  return <SsmSectionContent section={section} />;
}
