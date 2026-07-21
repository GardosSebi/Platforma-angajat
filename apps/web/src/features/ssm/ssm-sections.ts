import type { SsmSectionId } from "../../shared/auth/effective-permissions";

export type SsmSectionMeta = {
  id: SsmSectionId;
  path: string;
  title: string;
  caption: string;
  description: string;
  navLabel: string;
};

export const SSM_SECTIONS: SsmSectionMeta[] = [
  {
    id: "quick",
    path: "/ssm/quick",
    title: "Acțiune rapidă",
    caption: "Alocare instruire",
    description: "Folosește această secțiune pentru alocări punctuale către angajați.",
    navLabel: "Acțiune rapidă"
  },
  {
    id: "documents",
    path: "/ssm/documents",
    title: "Documente SSM",
    caption: "Vizualizare / upload",
    description:
      "Documente aplicabile postului și istoricul versiunilor; angajații văd doar documentele relevante pentru ei.",
    navLabel: "Documente"
  },
  {
    id: "training",
    path: "/ssm/training",
    title: "Instruire și conformitate",
    caption: "Calendar, teste, fișe",
    description:
      "Tipuri legale, e-learning, teste, semnături, calendar scadențe, remindere și raport conformitate pe departament.",
    navLabel: "Instruire"
  },
  {
    id: "eip",
    path: "/ssm/eip",
    title: "Echipamente EIP",
    caption: "Normative, mișcări, stoc",
    description: "Administrează tipurile EIP, normarea pe post și distribuțiile către personal.",
    navLabel: "EIP"
  },
  {
    id: "accidents",
    path: "/ssm/accidents",
    title: "Accidente și incidente",
    caption: "Cazuri, task-uri, statistici",
    description: "Înregistrează cazuri și urmărește fluxul de cercetare până la închidere.",
    navLabel: "Accidente"
  },
  {
    id: "medical",
    path: "/ssm/medical",
    title: "Medicina muncii",
    caption: "Aptitudini, fișe, reminder",
    description: "Configurează tipuri de controale medicale, rezultate și următoarele scadențe.",
    navLabel: "Medicină"
  },
  {
    id: "risk",
    path: "/ssm/risk",
    title: "Evaluări risc",
    caption: "Factori, nivel risc",
    description: "Versionează evaluări pe post, loc de muncă sau departament și păstrează motivul actualizării.",
    navLabel: "Evaluări risc"
  },
  {
    id: "ppp",
    path: "/ssm/ppp",
    title: "Plan PPP",
    caption: "Măsuri, responsabili, termene",
    description: "Planuri de prevenire și protecție cu măsuri urmărite individual.",
    navLabel: "Plan PPP"
  },
  {
    id: "psi",
    path: "/ssm/psi",
    title: "PSI / urgențe",
    caption: "Documentație, echipamente, instruiri",
    description: "Urmărește documentația PSI pe punct de lucru, scadențele echipamentelor și responsabilii.",
    navLabel: "PSI"
  },
  {
    id: "compliance",
    path: "/ssm/compliance",
    title: "Calendar + conformitate",
    caption: "KPI, status, restanțe",
    description: "Calendar unificat și dashboard cu breakdown, top neconformități și drill-down restanțe.",
    navLabel: "Conformitate"
  },
  {
    id: "reports",
    path: "/ssm/reports",
    title: "Rapoarte & export",
    caption: "PDF, Excel, inspector",
    description: "Rapoarte pentru instruiri, EIP, medicina muncii și documente/versionare.",
    navLabel: "Rapoarte"
  }
];

export const SSM_SECTION_IDS = new Set(SSM_SECTIONS.map((section) => section.id));

export function getSsmSection(id: string | undefined): SsmSectionMeta | undefined {
  if (!id || !SSM_SECTION_IDS.has(id as SsmSectionId)) return undefined;
  return SSM_SECTIONS.find((section) => section.id === id);
}
