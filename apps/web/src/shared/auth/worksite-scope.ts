/** Aliniat cu `worksite-viewer-scope.ts` din API — 3.12. */
const WORKSITE_SCOPED_ROLES = new Set([
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE"
]);

export function isWorksiteScopedViewer(roles?: string[]): boolean {
  if (!roles?.length) return false;
  if (roles.includes("SSM_ADMIN")) return false;
  return roles.some((r) => WORKSITE_SCOPED_ROLES.has(r));
}
