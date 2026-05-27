import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../logging/audit-log.service";
import { dataRetentionYears, SYSTEM_CRON_ACTOR } from "../scheduler/scheduler.constants";

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async archiveExpiredDocumentVersions(tenantId: string) {
    const years = dataRetentionYears();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);

    const versions = await this.prisma.ssmDocumentVersion.findMany({
      where: {
        tenantId,
        createdAt: { lt: cutoff },
        retentionArchivedAt: null
      },
      select: { id: true, documentId: true, versionNumber: true, fileName: true, createdAt: true },
      take: 500
    });

    if (!versions.length) {
      return { archived: 0, cutoff: cutoff.toISOString(), retentionYears: years };
    }

    const now = new Date();
    await this.prisma.ssmDocumentVersion.updateMany({
      where: { id: { in: versions.map((v) => v.id) } },
      data: { retentionArchivedAt: now }
    });

    await this.auditLog.write({
      tenantId,
      actorId: SYSTEM_CRON_ACTOR,
      module: "RETENTION",
      action: "DOCUMENT_VERSIONS_ARCHIVED",
      entityType: "SsmDocumentVersion",
      entityId: "batch",
      payload: {
        retentionYears: years,
        cutoff: cutoff.toISOString(),
        archivedCount: versions.length,
        versionIds: versions.map((v) => v.id),
        files: versions.map((v) => ({
          documentId: v.documentId,
          versionNumber: v.versionNumber,
          fileName: v.fileName,
          createdAt: v.createdAt.toISOString()
        }))
      }
    });

    this.logger.log(`Tenant ${tenantId}: archived ${versions.length} document version(s) older than ${years} years`);
    return { archived: versions.length, cutoff: cutoff.toISOString(), retentionYears: years };
  }
}
