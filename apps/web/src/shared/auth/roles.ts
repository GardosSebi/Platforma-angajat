import type { SessionData } from "./auth-store";

export function canAccessTenantAdmin(session: SessionData | null): boolean {
  const roles = session?.roles;
  if (!roles?.length) return false;
  return roles.includes("TENANT_ADMIN") || roles.includes("PLATFORM_ADMIN");
}
