import type { SessionData } from "./auth-store";

/** Administrator SSM — administrare utilizatori, master data, configurare modul. */
export function canAccessTenantAdmin(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  return roles.includes("SSM_ADMIN");
}
