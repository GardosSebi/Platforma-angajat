import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JwtPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { RoleAssignmentScope, SystemRole } from "./prisma-enums";

/** Vizibilitate limitată la punct(e) de lucru — 3.12 responsabil SSM, manager, angajat. */
export type WorksiteViewerScope =
  | { mode: "tenant" }
  | { mode: "worksite"; worksiteId: string }
  | { mode: "worksites"; worksiteIds: string[] }
  | { mode: "none" };

const WORKSITE_SCOPED_ROLES = new Set<string>([
  SystemRole.SSM_ENTITY_RESPONSIBLE,
  SystemRole.DEPARTMENT_MANAGER,
  SystemRole.EMPLOYEE
]);

export function isWorksiteScopedViewer(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  if (roles.includes(SystemRole.SSM_ADMIN)) return false;
  return roles.some((r) => WORKSITE_SCOPED_ROLES.has(r));
}

export function worksiteIdsFromScope(scope: WorksiteViewerScope): string[] | null {
  if (scope.mode === "tenant") return null;
  if (scope.mode === "none") return [];
  if (scope.mode === "worksite") return [scope.worksiteId];
  return scope.worksiteIds;
}

export function applyWorksiteToEmployeeWhere(
  where: Prisma.EmployeeWhereInput,
  scope: WorksiteViewerScope
): Prisma.EmployeeWhereInput {
  const ids = worksiteIdsFromScope(scope);
  if (ids === null) return where;
  if (ids.length === 0) {
    return { ...where, id: "__worksite_scope_none__" };
  }
  if (ids.length === 1) {
    return { ...where, worksiteId: ids[0] };
  }
  return { ...where, worksiteId: { in: ids } };
}

export function applyWorksiteToDepartmentWhere(
  where: Prisma.DepartmentWhereInput,
  scope: WorksiteViewerScope
): Prisma.DepartmentWhereInput {
  const ids = worksiteIdsFromScope(scope);
  if (ids === null) return where;
  if (ids.length === 0) {
    return { ...where, id: "__worksite_scope_none__" };
  }
  if (ids.length === 1) {
    return { ...where, worksiteId: ids[0] };
  }
  return { ...where, worksiteId: { in: ids } };
}

export function applyWorksiteToWorksiteWhere(
  where: Prisma.WorksiteWhereInput,
  scope: WorksiteViewerScope
): Prisma.WorksiteWhereInput {
  const ids = worksiteIdsFromScope(scope);
  if (ids === null) return where;
  if (ids.length === 0) {
    return { ...where, id: "__worksite_scope_none__" };
  }
  if (ids.length === 1) {
    return { ...where, id: ids[0] };
  }
  return { ...where, id: { in: ids } };
}

export async function resolveWorksiteViewerScope(
  prisma: PrismaService,
  tenantId: string,
  viewer: JwtPayload
): Promise<WorksiteViewerScope> {
  if (!isWorksiteScopedViewer(viewer.roles)) {
    return { mode: "tenant" };
  }

  const scopedRows = await prisma.userScopedRole.findMany({
    where: {
      tenantId,
      userId: viewer.sub,
      scope: RoleAssignmentScope.WORKSITE,
      worksiteId: { not: null }
    },
    select: { worksiteId: true }
  });
  const scopedIds = [
    ...new Set(scopedRows.map((r) => r.worksiteId).filter((id): id is string => Boolean(id)))
  ];

  const linked = await prisma.employee.findFirst({
    where: {
      tenantId,
      active: true,
      email: { equals: viewer.email.trim(), mode: "insensitive" }
    },
    select: { worksiteId: true }
  });

  const combined = new Set<string>(scopedIds);
  if (linked?.worksiteId) {
    combined.add(linked.worksiteId);
  }

  const ids = [...combined];
  if (ids.length === 0) {
    return { mode: "none" };
  }
  if (ids.length === 1) {
    return { mode: "worksite", worksiteId: ids[0] };
  }
  return { mode: "worksites", worksiteIds: ids };
}

export async function assertEmployeeInWorksiteScope(
  prisma: PrismaService,
  tenantId: string,
  employeeId: string,
  scope: WorksiteViewerScope
): Promise<void> {
  const ids = worksiteIdsFromScope(scope);
  if (ids === null) return;

  const count = await prisma.employee.count({
    where: applyWorksiteToEmployeeWhere({ tenantId, id: employeeId, active: true }, scope)
  });
  if (!count) {
    throw new ForbiddenException(
      "Angajatul nu aparține punctului tău de lucru. Poți comunica doar cu utilizatori din același punct de lucru."
    );
  }
}

export async function employeeIdsInWorksiteScope(
  prisma: PrismaService,
  tenantId: string,
  scope: WorksiteViewerScope
): Promise<string[]> {
  const ids = worksiteIdsFromScope(scope);
  if (ids === null) {
    const rows = await prisma.employee.findMany({
      where: { tenantId, active: true },
      select: { id: true }
    });
    return rows.map((r) => r.id);
  }
  const rows = await prisma.employee.findMany({
    where: applyWorksiteToEmployeeWhere({ tenantId, active: true }, scope),
    select: { id: true }
  });
  return rows.map((r) => r.id);
}
