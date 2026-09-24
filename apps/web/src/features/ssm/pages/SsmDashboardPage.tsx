import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { SsmGateManager } from "../components/SsmGateManager";
import { SsmCssmManager } from "../components/SsmCssmManager";
import { SsmSubstancesManager } from "../components/SsmSubstancesManager";

const SSM_GROUPS: Array<{ id: string; title: string; sections: SsmSectionId[] }> = [
  { id: "compliance", title: "Conformitate", sections: ["compliance", "reports"] },
  { id: "training", title: "Instruire", sections: ["training", "quick"] },
  { id: "documents", title: "Documente", sections: ["documents", "substances", "risk", "ppp"] },
  { id: "people", title: "Personal", sections: ["medical", "eip", "accidents"] },
  { id: "emergency", title: "Urgențe", sections: ["psi", "cssm", "gate"] }
];

const DEFAULT_SECTION: SsmSectionId = "compliance";

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
    id: "substances",
    title: "Substanțe periculoase",
    caption: "Registru, cantități, SDS",
    description:
      "Evidență pe punct de lucru: fișe SDS, cantități, locații de depozitare și scadențe de valabilitate."
  },
  {
    id: "training",
    title: "Instruire și conformitate",
    caption: "Calendar, teste, fișe",
    description:
      "Planificare, e-learning, semnături, calendar scadențe, fișa Anexa 11 și raport conformitate."
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
    description: "Registru cazuri, cercetare, măsuri corective, statistici și proces-verbal art. 128 HG 1425/2006."
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
    id: "cssm",
    title: "CSSM",
    caption: "Comisie, ședințe, PV",
    description:
      "Componența comitetului CSSM, convocări/ședințe și procese-verbale. Decizia de numire se publică automat în Documente (tip Decizie)."
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
  },
  {
    id: "gate",
    title: "Poartă / vizitatori",
    caption: "Wizard + nu intra la lucru",
    description:
      "Flux dedicat: înregistrare la poartă, instruire scurtă, fișă colectivă Anexa 12 semnată. Listă operațională de blocare admitere pentru șefi de tură și poartă."
  }
];

export function SsmDashboardPage() {
  const session = useAuthSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<SsmSectionId>(() =>
    SSM_SECTIONS.some((s) => s.id === sectionParam) ? (sectionParam as SsmSectionId) : DEFAULT_SECTION
  );

  const visibleSections = useMemo(
    () => SSM_SECTIONS.filter((s) => canAccessSsmSection(session?.roles, s.id)),
    [session?.roles]
  );

  const visibleGroups = useMemo(
    () =>
      SSM_GROUPS.map((group) => ({
        ...group,
        sections: group.sections.filter((id) => visibleSections.some((section) => section.id === id))
      })).filter((group) => group.sections.length > 0),
    [visibleSections]
  );

  const activeGroupId =
    visibleGroups.find((group) => group.sections.includes(activeSection))?.id ?? visibleGroups[0]?.id;

  const sectionsInGroup = useMemo(() => {
    const group = visibleGroups.find((item) => item.id === activeGroupId);
    return visibleSections.filter((section) => group?.sections.includes(section.id));
  }, [visibleGroups, activeGroupId, visibleSections]);

  const openSection = (sectionId: SsmSectionId) => {
    setActiveSection(sectionId);
    const params = new URLSearchParams(searchParams);
    params.set("section", sectionId);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (!session?.roles?.length) return;
    if (sectionParam && visibleSections.some((s) => s.id === sectionParam)) {
      setActiveSection(sectionParam as SsmSectionId);
      return;
    }
    if (!visibleSections.some((s) => s.id === activeSection)) {
      const fallback = visibleSections.some((s) => s.id === DEFAULT_SECTION)
        ? DEFAULT_SECTION
        : (visibleSections[0]?.id ?? DEFAULT_SECTION);
      setActiveSection(fallback);
    }
  }, [session?.roles, visibleSections, activeSection, sectionParam]);

  const activeSectionMeta = useMemo(
    () => SSM_SECTIONS.find((section) => section.id === activeSection) ?? visibleSections[0] ?? SSM_SECTIONS[0],
    [activeSection, visibleSections]
  );

  const renderSection = () => {
    switch (activeSection) {
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
      case "compliance":
        return <SsmComplianceDashboardManager />;
      case "reports":
        return <SsmReportsManager />;
      case "gate":
        return <SsmGateManager />;
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
          Nu ești autentificat. Acțiunile SSM necesită o sesiune activă. <Link to="/login">Autentifică-te</Link>.
        </div>
      ) : null}

      <section className="ssm-overview-card" aria-label="Navigare SSM">
        <div className="ssm-overview-header">
          <h2 className="card-title">Lucru zilnic SSM</h2>
          <p className="field-hint">
            Pornire pe calendar și restanțe. Alege zona, apoi secțiunea. Sunt afișate doar modulele permise de rolul tău.
          </p>
        </div>
        <div className="ssm-nav-groups" role="tablist" aria-label="Zone SSM">
          {visibleGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroupId === group.id}
              className={`ssm-nav-group ${activeGroupId === group.id ? "active" : ""}`}
              onClick={() => {
                const first = group.sections[0];
                if (first) openSection(first);
              }}
            >
              {group.title}
            </button>
          ))}
        </div>
        <div className="ssm-section-tabs" role="tablist" aria-label="Secțiuni SSM">
          {sectionsInGroup.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`ssm-overview-tab ${activeSection === section.id ? "active" : ""}`}
              onClick={() => openSection(section.id)}
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
