import type { SessionData } from "./auth-store";

const SSM_BACKOFFICE_ROLES = ["SSM_ADMIN", "SSM_ENTITY_RESPONSIBLE", "DEPARTMENT_MANAGER"] as const;
const ITM_INSPECTOR_ROLES = ["ITM_INSPECTOR"] as const;

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

/** Inspector ITM/ISU — vizualizare dosar control, fără editare SSM. */
export function isItmInspectorUser(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  if (hasSsmBackofficeAccess(session)) return false;
  return roles.some((role) => (ITM_INSPECTOR_ROLES as readonly string[]).includes(role));
}

/** Utilizator cu rol EMPLOYEE și fără roluri SSM de administrare — vede portalul angajat. */
export function isEmployeePortalUser(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  if (!roles.includes("EMPLOYEE")) return false;
  return !hasSsmBackofficeAccess(session) && !isItmInspectorUser(session);
}

/** Poate deschide portalul angajat (inclusiv conturi cu rol dublu EMPLOYEE + backoffice). */
export function canAccessEmployeePortal(session: SessionData | null): boolean {
  return Boolean(session?.roles?.includes("EMPLOYEE"));
}

/** Pagina implicită după autentificare — evită bucle de redirect. */
export function getAppHomePath(session: SessionData | null): string {
  if (!session) return "/login";
  if (isEmployeePortalUser(session)) return "/portal";
  if (isItmInspectorUser(session)) return "/itm";
  if (hasSsmBackofficeAccess(session)) return "/ssm";
  if (canAccessEmployeePortal(session)) return "/portal";
  return "/informatii";
}

export function requireLinkedEmployeeId(session: SessionData | null): string | null {
  return session?.linkedEmployeeId?.trim() || null;
}
