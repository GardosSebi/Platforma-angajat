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

  retentionPolicy() {
    const years = dataRetentionYears();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return {
      retentionYears: years,
      cutoff: cutoff.toISOString(),
      dsarExportEnabled: false as const,
      dsarEraseEnabled: false as const
    };
  }

  /** Marks records older than the retention window. Does not delete data and does not run DSAR erase. */
  async archiveExpiredDocumentVersions(tenantId: string) {
    return this.archiveDueRecords(tenantId);
  }

  async archiveDueRecords(tenantId: string) {
    const policy = this.retentionPolicy();
    const cutoff = new Date(policy.cutoff);
    const now = new Date();

    const results = await Promise.all([
      this.prisma.ssmDocumentVersion.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmDocumentTemplate.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmTrainingPlan.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmTrainingSignature.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmEipMovement.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmAccidentAttachment.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.ssmMedicalControl.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.communicationAnnouncement.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.communicationTemplate.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.surveyResponse.updateMany({
        where: { tenantId, submittedAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      }),
      this.prisma.employeeStaticPage.updateMany({
        where: { tenantId, createdAt: { lt: cutoff }, retentionArchivedAt: null },
        data: { retentionArchivedAt: now }
      })
    ]);

    const labels = [
      "DOCUMENT_VERSION",
      "DOCUMENT_TEMPLATE",
      "TRAINING_MATERIAL",
      "TRAINING_SIGNATURE",
      "EIP_SIGNATURE",
      "ACCIDENT_ATTACHMENT",
      "MEDICAL_APTITUDE",
      "COMMS_MEDIA",
      "COMMS_TEMPLATE",
      "SURVEY_ANSWER",
      "STATIC_PAGE_ATTACHMENT"
    ];
    const batches = results
      .map((result, index) => ({ category: labels[index] ?? "UNKNOWN", archived: result.count }))
      .filter((row) => row.archived > 0);
    const archived = batches.reduce((sum, row) => sum + row.archived, 0);

    if (archived > 0) {
      await this.auditLog.write({
        tenantId,
        actorId: SYSTEM_CRON_ACTOR,
        module: "RETENTION",
        action: "RECORDS_ARCHIVED",
        entityType: "RetentionBatch",
        entityId: "batch",
        payload: {
          retentionYears: policy.retentionYears,
          cutoff: policy.cutoff,
          archivedCount: archived,
          batches
        }
      });
    }

    this.logger.log(
      `Tenant ${tenantId}: archived ${archived} record(s) older than ${policy.retentionYears} years`
    );
    return {
      archived,
      cutoff: policy.cutoff,
      retentionYears: policy.retentionYears,
      batches
    };
  }

  async overview(tenantId: string) {
    const policy = this.retentionPolicy();
    const [
      documentVersions,
      documentTemplates,
      trainingMaterials,
      trainingSignatures,
      eipSignatures,
      accidentAttachments,
      medicalAptitude,
      commsMedia,
      commsTemplates,
      surveyAnswers,
      staticPages,
      recent
    ] = await Promise.all([
      this.prisma.ssmDocumentVersion.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmDocumentTemplate.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmTrainingPlan.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmTrainingSignature.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmEipMovement.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmAccidentAttachment.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.ssmMedicalControl.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.communicationAnnouncement.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.communicationTemplate.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.surveyResponse.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.employeeStaticPage.count({ where: { tenantId, retentionArchivedAt: { not: null } } }),
      this.prisma.auditLog.findMany({
        where: { tenantId, module: "RETENTION" },
        orderBy: { createdAt: "desc" },
        take: 40
      })
    ]);

    const actorIds = [...new Set(recent.map((row) => row.actorId))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { tenantId, id: { in: actorIds } },
          select: { id: true, email: true, fullName: true }
        })
      : [];
    const actorMap = new Map(actors.map((user) => [user.id, user]));

    return {
      policy: {
        retentionYears: policy.retentionYears,
        dsarExportEnabled: false as const,
        dsarEraseEnabled: false as const
      },
      cutoff: policy.cutoff,
      archivedCounts: [
        { category: "Versiuni documente SSM", archived: documentVersions },
        { category: "Șabloane documente", archived: documentTemplates },
        { category: "Materiale instruire", archived: trainingMaterials },
        { category: "Semnături instruire", archived: trainingSignatures },
        { category: "Mișcări EIP", archived: eipSignatures },
        { category: "Atașamente accidente", archived: accidentAttachments },
        { category: "Fișe aptitudini", archived: medicalAptitude },
        { category: "Media comunicări", archived: commsMedia },
        { category: "Șabloane comunicări", archived: commsTemplates },
        { category: "Răspunsuri sondaje", archived: surveyAnswers },
        { category: "Pagini statice", archived: staticPages }
      ],
      recentRetentionEvents: recent.map((row) => {
        const actor = actorMap.get(row.actorId);
        return {
          id: row.id,
          actorId: row.actorId,
          actorEmail: actor?.email ?? (row.actorId === SYSTEM_CRON_ACTOR ? "system-cron" : null),
          actorName: actor?.fullName ?? (row.actorId === SYSTEM_CRON_ACTOR ? "Job retenție" : null),
          module: row.module,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          payload: row.payload,
          createdAt: row.createdAt.toISOString()
        };
      })
    };
  }
}
