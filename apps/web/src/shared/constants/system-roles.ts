export const ALL_SYSTEM_ROLES = [
  "SSM_ADMIN",
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER",
  "ITM_INSPECTOR",
  "EMPLOYEE"
] as const;

export type SystemRoleCode = (typeof ALL_SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_LABELS_RO: Record<SystemRoleCode, string> = {
  SSM_ADMIN: "Administrator SSM — acces complet la toate entitățile; configurare modul; rapoarte globale",
  SSM_ENTITY_RESPONSIBLE:
    "Responsabil SSM (per entitate) — administrare completă pentru entitatea sa: documente, instruiri, EIP, accidente, calendar",
  DEPARTMENT_MANAGER:
    "Manager / șef de departament — vizualizare situație echipă proprie; aprobare instruiri la locul de muncă; alertă la neconformități",
  ITM_INSPECTOR:
    "Inspector ITM/ISU — vizualizare dosar control (documente marcate), accidente, rapoarte; fără editare",
  EMPLOYEE:
    "Angajat — acces la propriile documente și fișe de instruire; parcurgere instruiri online; vizualizare dosar personal"
};

export const SYSTEM_ROLE_CARD_OPTIONS = ALL_SYSTEM_ROLES.map((role) => ({
  value: role,
  title: role,
  description: SYSTEM_ROLE_LABELS_RO[role],
  monospaceTitle: true
}));

export function assignableSystemRoles(actorRoles: string[] | undefined): SystemRoleCode[] {
  if (actorRoles?.includes("SSM_ADMIN")) {
    return [...ALL_SYSTEM_ROLES];
  }
  return ALL_SYSTEM_ROLES.filter((r) => r !== "SSM_ADMIN");
}
