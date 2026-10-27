import { canAccessSsmSection, type SsmSectionId } from "../../shared/auth/effective-permissions";

export type SsmSectionMeta = {
  id: SsmSectionId;
  label: string;
  description: string;
};

/** Ordinea din meniul lateral. `gate` are pagină proprie (`/ssm/poarta`). */
export const SSM_SECTIONS: SsmSectionMeta[] = [
  { id: "compliance", label: "Calendar și restanțe", description: "Scadențe, restanțe și starea conformității." },
  { id: "training", label: "Instruiri", description: "Planificare, teste, semnături și fișe de instruire." },
  { id: "quick", label: "Alocare instruire", description: "Alocă rapid o instruire unuia sau mai multor angajați." },
  { id: "medical", label: "Medicina muncii", description: "Controale medicale, rezultate și reminder-uri." },
  { id: "eip", label: "Echipamente EIP", description: "Tipuri EIP, normare pe post, distribuiri și stoc." },
  { id: "accidents", label: "Accidente", description: "Registru, cercetare și măsuri corective." },
  { id: "risk", label: "Evaluări risc", description: "Evaluări pe post sau punct de lucru și fișe de expunere." },
  { id: "ppp", label: "Plan PPP", description: "Măsuri de prevenire cu responsabili și termene." },
  { id: "documents", label: "Documente", description: "Documente SSM pe post și istoricul versiunilor." },
  { id: "substances", label: "Substanțe periculoase", description: "Registru, cantități și fișe SDS." },
  { id: "conventions", label: "Convenții SSM", description: "Convenții cu firme terțe pe șantiere și depozite comune." },
  { id: "psi", label: "PSI / urgențe", description: "Echipamente PSI, verificări, exerciții și control ISU." },
  { id: "cssm", label: "CSSM", description: "Comitet, ședințe și procese-verbale." },
  { id: "reports", label: "Rapoarte", description: "Export PDF și Excel pentru control." }
];

export const DEFAULT_SSM_SECTION: SsmSectionId = "compliance";

export function ssmSectionPath(id: SsmSectionId): string {
  return id === "gate" ? "/ssm/poarta" : `/ssm/${id}`;
}

export function visibleSsmSections(roles: string[] | undefined): SsmSectionMeta[] {
  return SSM_SECTIONS.filter((section) => canAccessSsmSection(roles, section.id));
}
