import type { SessionData } from "./auth-store";

const SSM_BACKOFFICE_ROLES = ["SSM_ADMIN", "SSM_ENTITY_RESPONSIBLE", "DEPARTMENT_MANAGER"] as const;

/** Administrator SSM — administrare utilizatori, master data, configurare modul. */
export function canAccessTenantAdmin(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  return roles.includes("SSM_ADMIN");
}

/** Acces la panoul SSM administrativ (nu portal angajat). */
export function hasSsmBackofficeAccess(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  return roles.some((role) => (SSM_BACKOFFICE_ROLES as readonly string[]).includes(role));
}

/** Utilizator cu rol EMPLOYEE și fără roluri SSM de administrare — vede portalul angajat. */
export function isEmployeePortalUser(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  if (!roles.includes("EMPLOYEE")) return false;
  return !hasSsmBackofficeAccess(session);
}

export function requireLinkedEmployeeId(session: SessionData | null): string | null {
  return session?.linkedEmployeeId?.trim() || null;
}
