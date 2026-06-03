import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { SystemRole } from "../../../common/prisma-enums";
import {
  resolveWorksiteViewerScope,
  worksiteIdsFromScope,
  type WorksiteViewerScope
} from "../../../common/worksite-viewer-scope";

const SSM_CATALOG_ROLES = new Set([SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE, SystemRole.DEPARTMENT_MANAGER]);

export function hasSsmElevatedRole(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => SSM_CATALOG_ROLES.has(r as SystemRole));
}

export async function findEmployeeIdForUserEmail(
  prisma: PrismaService,
  tenantId: string,
  email: string
): Promise<string | null> {
  const row = await prisma.employee.findFirst({
    where: {
      tenantId,
      active: true,
      email: { equals: email.trim(), mode: "insensitive" }
    },
    select: { id: true }
  });
  return row?.id ?? null;
}

export type SsmViewerScope =
  | { mode: "tenant" }
  | { mode: "worksite"; worksiteId: string }
  | { mode: "worksites"; worksiteIds: string[] }
  | { mode: "self"; employeeId: string }
  | { mode: "empty" };

function mapWorksiteToSsm(ws: WorksiteViewerScope): SsmViewerScope {
  if (ws.mode === "tenant") return { mode: "tenant" };
  if (ws.mode === "none") return { mode: "empty" };
  if (ws.mode === "worksite") return { mode: "worksite", worksiteId: ws.worksiteId };
  return { mode: "worksites", worksiteIds: ws.worksiteIds };
}

export function ssmTrainingPlanWhere(tenantId: string, scope: SsmViewerScope): Prisma.SsmTrainingPlanWhereInput {
  const base: Prisma.SsmTrainingPlanWhereInput = { tenantId };
  if (scope.mode === "tenant") return base;
  if (scope.mode === "empty") return { ...base, id: "__ssm_scope_none__" };
  if (scope.mode === "self") return { ...base, employeeId: scope.employeeId };
  const ids = scope.mode === "worksite" ? [scope.worksiteId] : scope.worksiteIds;
  return {
    ...base,
    employee: {
      tenantId,
      worksiteId: ids.length === 1 ? ids[0] : { in: ids }
    }
  };
}

export function ssmEmployeeWhere(tenantId: string, scope: SsmViewerScope): Prisma.EmployeeWhereInput {
  const base: Prisma.EmployeeWhereInput = { tenantId, active: true };
  if (scope.mode === "tenant") return base;
  if (scope.mode === "empty") return { ...base, id: "__ssm_scope_none__" };
  if (scope.mode === "self") return { ...base, id: scope.employeeId };
  const ids = scope.mode === "worksite" ? [scope.worksiteId] : scope.worksiteIds;
  return {
    ...base,
    worksiteId: ids.length === 1 ? ids[0] : { in: ids }
  };
}

export async function resolveSsmViewerScope(
  prisma: PrismaService,
  tenantId: string,
  viewer: JwtPayload
): Promise<SsmViewerScope> {
  const roles = viewer.roles ?? [];
  if (roles.includes(SystemRole.SSM_ADMIN) || roles.includes(SystemRole.ITM_INSPECTOR)) {
    return { mode: "tenant" };
  }

  const isManagerOrResponsible = roles.some(
    (r) => r === SystemRole.SSM_ENTITY_RESPONSIBLE || r === SystemRole.DEPARTMENT_MANAGER
  );
  if (isManagerOrResponsible) {
    return mapWorksiteToSsm(await resolveWorksiteViewerScope(prisma, tenantId, viewer));
  }

  if (roles.includes(SystemRole.EMPLOYEE)) {
    const employeeId = await findEmployeeIdForUserEmail(prisma, tenantId, viewer.email);
    if (!employeeId) {
      return { mode: "empty" };
    }
    return { mode: "self", employeeId };
  }

  return { mode: "tenant" };
}

export async function assertSsmEmployeeAccess(
  prisma: PrismaService,
  tenantId: string,
  employeeId: string,
  scope: SsmViewerScope
): Promise<void> {
  if (scope.mode === "tenant") return;
  if (scope.mode === "empty") {
    throw new ForbiddenException("Contul nu este asociat unui angajat pentru acces SSM.");
  }
  if (scope.mode === "self") {
    if (employeeId !== scope.employeeId) {
      throw new ForbiddenException("Puteți consulta doar propriul dosar personal SSM.");
    }
    return;
  }
  const ids = worksiteIdsFromScope(
    scope.mode === "worksite"
      ? { mode: "worksite", worksiteId: scope.worksiteId }
      : { mode: "worksites", worksiteIds: scope.worksiteIds }
  );
  if (!ids?.length) {
    throw new ForbiddenException("Nu aveți un punct de lucru alocat.");
  }
  const ok = await prisma.employee.count({
    where: {
      id: employeeId,
      tenantId,
      worksiteId: ids.length === 1 ? ids[0] : { in: ids }
    }
  });
  if (!ok) {
    throw new ForbiddenException(
      "Angajatul nu aparține punctului tău de lucru. Vizualizarea este limitată la același punct de lucru."
    );
  }
}

export function assertSsmTrainingCatalogManagement(viewer: JwtPayload | undefined): asserts viewer is JwtPayload {
  if (!viewer?.roles?.length) {
    throw new ForbiddenException("Missing user context");
  }
  if (!hasSsmElevatedRole(viewer.roles)) {
    throw new ForbiddenException(
      "Doar administratorii SSM, responsabilii pe entitate sau managerii de departament pot configura instruirile la nivel de catalog."
    );
  }
}
