import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SystemRole } from "../../../../common/prisma-enums";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";

@Injectable()
export class ItmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertItmInspectorAccess(tenantId: string, userId: string, roles: string[]): Promise<void> {
    if (!roles.includes(SystemRole.ITM_INSPECTOR)) {
      return;
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user?.itmAccessExpiresAt) {
      throw new ForbiddenException("Accesul inspector ITM nu este activat. Contactați administratorul.");
    }
    if (user.itmAccessExpiresAt < new Date()) {
      throw new ForbiddenException("Accesul inspector ITM a expirat.");
    }
  }

  async grantTemporaryAccess(
    tenantId: string,
    userId: string,
    expiresAt: Date,
    grantedBy: string
  ) {
    return this.prisma.user.update({
      where: { id: userId, tenantId },
      data: { itmAccessExpiresAt: expiresAt }
    });
  }

  async logAccess(
    tenantId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, unknown>
  ) {
    await this.prisma.itmAccessLog.create({
      data: {
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listAccessLogs(tenantId: string, limit = 100) {
    const rows = await this.prisma.itmAccessLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { email: true, fullName: true } }
      }
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userEmail: row.user.email,
      userName: row.user.fullName,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      metadata: row.metadata,
      createdAt: row.createdAt
    }));
  }
}
