import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SystemRole } from "../../../../common/prisma-enums";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";

const RESOURCE_LABELS: Record<string, string> = {
  SsmDocument: "Document SSM",
  ItmControlFolder: "Dosar control",
  ItmControlPackage: "Pachet control ZIP",
  ItmInspectionVisit: "Vizită control"
};

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

  async listAccessLogs(tenantId: string, limit = 100, userId?: string) {
    const rows = await this.prisma.itmAccessLog.findMany({
      where: { tenantId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { email: true, fullName: true } }
      }
    });

    const documentIds = [
      ...new Set(
        rows
          .filter((row) => row.resourceType === "SsmDocument" && row.resourceId)
          .map((row) => row.resourceId as string)
      )
    ];
    const documents = documentIds.length
      ? await this.prisma.ssmDocument.findMany({
          where: { tenantId, id: { in: documentIds } },
          select: { id: true, title: true }
        })
      : [];
    const titleByDocId = new Map(documents.map((doc) => [doc.id, doc.title]));

    const visitIds = [
      ...new Set(
        rows
          .filter((row) => row.resourceType === "ItmInspectionVisit" && row.resourceId)
          .map((row) => row.resourceId as string)
      )
    ];
    const visits = visitIds.length
      ? await this.prisma.itmInspectionVisit.findMany({
          where: { tenantId, id: { in: visitIds } },
          include: { worksite: { select: { name: true } } }
        })
      : [];
    const visitTitleById = new Map(
      visits.map((visit) => [
        visit.id,
        [visit.inspectorName, visit.worksite?.name, visit.startedAt.toLocaleString("ro-RO")]
          .filter(Boolean)
          .join(" · ")
      ])
    );

    return rows.map((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      const metaTitle = typeof meta?.title === "string" ? meta.title : null;
      let resourceTitle: string | null = metaTitle;
      if (row.resourceType === "SsmDocument" && row.resourceId) {
        resourceTitle = titleByDocId.get(row.resourceId) ?? metaTitle;
      } else if (row.resourceType === "ItmInspectionVisit" && row.resourceId) {
        resourceTitle = visitTitleById.get(row.resourceId) ?? metaTitle;
      } else if (row.resourceType === "ItmControlFolder" || row.resourceType === "ItmControlPackage") {
        resourceTitle =
          row.resourceId === "all" ? "Toate punctele de lucru" : (row.resourceId ?? metaTitle);
      }
      return {
        id: row.id,
        userId: row.userId,
        userEmail: row.user.email,
        userName: row.user.fullName,
        action: row.action,
        resourceType: row.resourceType,
        resourceLabel: RESOURCE_LABELS[row.resourceType] ?? row.resourceType,
        resourceTitle,
        resourceId: row.resourceId,
        metadata: row.metadata,
        createdAt: row.createdAt
      };
    });
  }
}
