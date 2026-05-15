import { ForbiddenException } from "@nestjs/common";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";

const SSM_ELEVATED_ROLES = new Set([
  "SSM_ADMIN",
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER"
]);

export function hasSsmElevatedRole(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => SSM_ELEVATED_ROLES.has(r));
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

export type SsmViewerScope = { mode: "tenant" } | { mode: "self"; employeeId: string } | { mode: "empty" };

export async function resolveSsmViewerScope(
  prisma: PrismaService,
  tenantId: string,
  viewer: JwtPayload
): Promise<SsmViewerScope> {
  const roles = viewer.roles ?? [];
  if (hasSsmElevatedRole(roles)) {
    return { mode: "tenant" };
  }
  if (!roles.includes("EMPLOYEE")) {
    return { mode: "tenant" };
  }
  const employeeId = await findEmployeeIdForUserEmail(prisma, tenantId, viewer.email);
  if (!employeeId) {
    return { mode: "empty" };
  }
  return { mode: "self", employeeId };
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
