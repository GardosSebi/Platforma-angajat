import { canAccessSsmSection, type SsmSectionId } from "../../shared/auth/effective-permissions";

export type SsmSectionMeta = {
  id: SsmSectionId;
  label: string;
};

/** Ordinea din meniul lateral. `gate` are pagină proprie (`/ssm/poarta`). */
export const SSM_SECTIONS: SsmSectionMeta[] = [
  { id: "compliance", label: "Calendar și restanțe" },
  { id: "training", label: "Instruiri" },
  { id: "medical", label: "Medicina muncii" },
  { id: "eip", label: "Echipamente EIP" },
  { id: "accidents", label: "Accidente" },
  { id: "risk", label: "Evaluări risc" },
  { id: "ppp", label: "Plan PPP" },
  { id: "documents", label: "Documente" },
  { id: "substances", label: "Substanțe periculoase" },
  { id: "conventions", label: "Convenții SSM" },
  { id: "psi", label: "PSI / urgențe" },
  { id: "cssm", label: "CSSM" },
  { id: "reports", label: "Rapoarte" }
];

export const DEFAULT_SSM_SECTION: SsmSectionId = "compliance";

export function ssmSectionPath(id: SsmSectionId): string {
  return id === "gate" ? "/ssm/poarta" : `/ssm/${id}`;
}

export function visibleSsmSections(roles: string[] | undefined): SsmSectionMeta[] {
  return SSM_SECTIONS.filter((section) => canAccessSsmSection(roles, section.id));
}
