import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommunicationAnnouncement,
  CommunicationAnnouncementStatus,
  CommunicationAudienceType,
  CommunicationContentType
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  CreateAnnouncementDto,
  CreateTemplateDto,
  MarkAnnouncementReadDto,
  UpdateAnnouncementDto
} from "../../api/dto/communications.dto";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Dată invalidă: ${value}`);
  }
  return date;
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function dedupe(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function audienceLabel(audienceType: CommunicationAudienceType): string {
  const labels: Record<CommunicationAudienceType, string> = {
    ALL: "Toți angajații",
    WORKSITE: "Punct de lucru",
    DEPARTMENT: "Departament",
    JOB_POSITION: "Post",
    EMPLOYEE_GROUP: "Grup angajați",
    EMPLOYEE: "Angajat",
    CUSTOM: "Listă personalizată"
  };
  return labels[audienceType];
}

function statusForPublish(
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED" | undefined,
  publishAt?: Date | null
): CommunicationAnnouncementStatus {
  if (status === "DRAFT") return CommunicationAnnouncementStatus.DRAFT;
  if (status === "ARCHIVED") return CommunicationAnnouncementStatus.ARCHIVED;
  if (publishAt && publishAt.getTime() > Date.now()) return CommunicationAnnouncementStatus.SCHEDULED;
  return status === "SCHEDULED" ? CommunicationAnnouncementStatus.SCHEDULED : CommunicationAnnouncementStatus.PUBLISHED;
}

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async dashboard(tenantId: string) {
    const [activeEmployees, announcements, latest] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, active: true } }),
      this.prisma.communicationAnnouncement.findMany({
        where: { tenantId, status: { in: [CommunicationAnnouncementStatus.PUBLISHED, CommunicationAnnouncementStatus.SCHEDULED] } },
        include: { readReceipts: { select: { employeeId: true } } }
      }),
      this.prisma.communicationAnnouncement.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    const activeAnnouncements = announcements.filter((item) => item.status === CommunicationAnnouncementStatus.PUBLISHED).length;
    const scheduledAnnouncements = announcements.filter((item) => item.status === CommunicationAnnouncementStatus.SCHEDULED).length;
    const readEmployees = new Set(announcements.flatMap((item) => item.readReceipts.map((receipt) => receipt.employeeId))).size;
    const latestAnnouncements = await this.withStats(tenantId, latest);
    const totals = latestAnnouncements.reduce(
      (acc, item) => ({
        targetCount: acc.targetCount + item.stats.targetCount,
        readCount: acc.readCount + item.stats.readCount,
        unreadCount: acc.unreadCount + item.stats.unreadCount
      }),
      { targetCount: 0, readCount: 0, unreadCount: 0 }
    );

    return {
      kpi: {
        digitalizationRate: activeEmployees ? Math.round((readEmployees / activeEmployees) * 100) : 0,
        activeEmployees,
        activeAnnouncements,
        scheduledAnnouncements,
        readRate: totals.targetCount ? Math.round((totals.readCount / totals.targetCount) * 100) : 0,
        unreadEstimate: totals.unreadCount
      },
      latestAnnouncements,
      reminders: await this.reminders(tenantId)
    };
  }

  async listAnnouncements(tenantId: string) {
    const rows = await this.prisma.communicationAnnouncement.findMany({
      where: { tenantId },
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
      take: 200
    });
    return { items: await this.withStats(tenantId, rows) };
  }

  async createAnnouncement(tenantId: string, actorId: string, dto: CreateAnnouncementDto) {
    await this.assertAudience(tenantId, dto.audienceType, dto.audienceRefId, dto.targetEmployeeIds);
    if (dto.templateId) {
      await this.assertTemplate(tenantId, dto.templateId);
    }

    const publishAt = parseOptionalDate(dto.publishAt);
    const created = await this.prisma.communicationAnnouncement.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        contentType: dto.contentType ?? CommunicationContentType.TEXT,
        contentUrl: clean(dto.contentUrl),
        audienceType: dto.audienceType,
        audienceRefId: clean(dto.audienceRefId),
        audienceLabel: clean(dto.audienceLabel),
        targetEmployeeIds: dedupe(dto.targetEmployeeIds),
        status: statusForPublish(dto.status, publishAt),
        publishAt,
        expiresAt: parseOptionalDate(dto.expiresAt),
        reminderAt: parseOptionalDate(dto.reminderAt),
        templateId: clean(dto.templateId),
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_CREATED",
      entityType: "CommunicationAnnouncement",
      entityId: created.id,
      payload: { status: created.status, audienceType: created.audienceType }
    });

    return this.getAnnouncement(tenantId, created.id);
  }

  async updateAnnouncement(tenantId: string, actorId: string, id: string, dto: UpdateAnnouncementDto) {
    const current = await this.assertAnnouncement(tenantId, id);
    const audienceType = dto.audienceType ?? current.audienceType;
    const audienceRefId = dto.audienceRefId ?? current.audienceRefId ?? undefined;
    const targetEmployeeIds = dto.targetEmployeeIds ?? current.targetEmployeeIds;
    await this.assertAudience(tenantId, audienceType, audienceRefId, targetEmployeeIds);

    const publishAt = dto.publishAt === undefined ? current.publishAt : parseOptionalDate(dto.publishAt);
    const data = {
      title: dto.title?.trim(),
      body: dto.body?.trim(),
      contentType: dto.contentType,
      contentUrl: dto.contentUrl === undefined ? undefined : clean(dto.contentUrl) ?? null,
      audienceType: dto.audienceType,
      audienceRefId: dto.audienceRefId === undefined ? undefined : clean(dto.audienceRefId) ?? null,
      audienceLabel: dto.audienceLabel === undefined ? undefined : clean(dto.audienceLabel) ?? null,
      targetEmployeeIds: dto.targetEmployeeIds === undefined ? undefined : dedupe(dto.targetEmployeeIds),
      status: dto.status ? statusForPublish(dto.status, publishAt) : undefined,
      publishAt,
      expiresAt: dto.expiresAt === undefined ? undefined : parseOptionalDate(dto.expiresAt) ?? null,
      reminderAt: dto.reminderAt === undefined ? undefined : parseOptionalDate(dto.reminderAt) ?? null
    };

    await this.prisma.communicationAnnouncement.update({ where: { id }, data });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_UPDATED",
      entityType: "CommunicationAnnouncement",
      entityId: id
    });

    return this.getAnnouncement(tenantId, id);
  }

  async publishAnnouncement(tenantId: string, actorId: string, id: string) {
    const current = await this.assertAnnouncement(tenantId, id);
    const status = statusForPublish("PUBLISHED", current.publishAt ?? undefined);
    await this.prisma.communicationAnnouncement.update({ where: { id }, data: { status, retractedAt: null } });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_PUBLISHED",
      entityType: "CommunicationAnnouncement",
      entityId: id,
      payload: { status }
    });
    return this.getAnnouncement(tenantId, id);
  }

  async retractAnnouncement(tenantId: string, actorId: string, id: string) {
    await this.assertAnnouncement(tenantId, id);
    await this.prisma.communicationAnnouncement.update({
      where: { id },
      data: { status: CommunicationAnnouncementStatus.RETRACTED, retractedAt: new Date() }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_RETRACTED",
      entityType: "CommunicationAnnouncement",
      entityId: id
    });
    return this.getAnnouncement(tenantId, id);
  }

  async duplicateAnnouncement(tenantId: string, actorId: string, id: string) {
    const source = await this.assertAnnouncement(tenantId, id);
    const duplicated = await this.prisma.communicationAnnouncement.create({
      data: {
        tenantId,
        title: `${source.title} (copie)`,
        body: source.body,
        contentType: source.contentType,
        contentUrl: source.contentUrl,
        audienceType: source.audienceType,
        audienceRefId: source.audienceRefId,
        audienceLabel: source.audienceLabel,
        targetEmployeeIds: source.targetEmployeeIds,
        status: CommunicationAnnouncementStatus.DRAFT,
        templateId: source.templateId,
        duplicatedFromId: source.id,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_DUPLICATED",
      entityType: "CommunicationAnnouncement",
      entityId: duplicated.id,
      payload: { duplicatedFromId: id }
    });
    return this.getAnnouncement(tenantId, duplicated.id);
  }

  async markRead(tenantId: string, announcementId: string, dto: MarkAnnouncementReadDto) {
    await this.assertAnnouncement(tenantId, announcementId);
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, active: true } });
    if (!employee) {
      throw new NotFoundException("Angajatul nu a fost găsit pentru tenantul curent.");
    }
    return this.prisma.communicationAnnouncementRead.upsert({
      where: { announcementId_employeeId: { announcementId, employeeId: employee.id } },
      create: { tenantId, announcementId, employeeId: employee.id },
      update: { readAt: new Date() }
    });
  }

  async reminders(tenantId: string) {
    const rows = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        reminderAt: { not: null },
        status: { in: [CommunicationAnnouncementStatus.PUBLISHED, CommunicationAnnouncementStatus.SCHEDULED] }
      },
      orderBy: { reminderAt: "asc" },
      take: 80
    });
    const withStats = await this.withStats(tenantId, rows);
    return withStats.map((item) => ({
      announcementId: item.id,
      title: item.title,
      reminderAt: item.reminderAt,
      status: item.status,
      readRate: item.stats.readRate,
      unreadCount: item.stats.unreadCount,
      lastReminderSentAt: item.lastReminderSentAt
    }));
  }

  async dispatchReminders(tenantId: string, actorId: string) {
    const now = new Date();
    const due = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        status: CommunicationAnnouncementStatus.PUBLISHED,
        reminderAt: { lte: now },
        OR: [{ lastReminderSentAt: null }, { lastReminderSentAt: { lt: now } }]
      }
    });

    for (const item of due) {
      await this.prisma.$transaction([
        this.prisma.communicationReminderDispatch.create({
          data: {
            tenantId,
            announcementId: item.id,
            scheduledFor: item.reminderAt ?? now,
            createdBy: actorId
          }
        }),
        this.prisma.communicationAnnouncement.update({
          where: { id: item.id },
          data: { lastReminderSentAt: now }
        })
      ]);
    }

    if (due.length) {
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "COMMUNICATIONS",
        action: "REMINDERS_DISPATCHED",
        entityType: "CommunicationReminderDispatch",
        entityId: "batch",
        payload: { sent: due.length }
      });
    }

    return { sent: due.length };
  }

  async listTemplates(tenantId: string) {
    return {
      items: await this.prisma.communicationTemplate.findMany({
        where: { tenantId },
        orderBy: [{ active: "desc" }, { name: "asc" }]
      })
    };
  }

  async createTemplate(tenantId: string, actorId: string, dto: CreateTemplateDto) {
    await this.assertAudience(tenantId, dto.audienceType ?? CommunicationAudienceType.ALL, dto.audienceRefId);
    const created = await this.prisma.communicationTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        contentType: dto.contentType ?? CommunicationContentType.TEXT,
        contentUrl: clean(dto.contentUrl),
        audienceType: dto.audienceType ?? CommunicationAudienceType.ALL,
        audienceRefId: clean(dto.audienceRefId),
        audienceLabel: clean(dto.audienceLabel),
        active: dto.active ?? true,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "TEMPLATE_CREATED",
      entityType: "CommunicationTemplate",
      entityId: created.id
    });
    return created;
  }

  private async getAnnouncement(tenantId: string, id: string) {
    const row = await this.assertAnnouncement(tenantId, id);
    const [item] = await this.withStats(tenantId, [row]);
    return item;
  }

  private async assertAnnouncement(tenantId: string, id: string) {
    const announcement = await this.prisma.communicationAnnouncement.findFirst({ where: { id, tenantId } });
    if (!announcement) {
      throw new NotFoundException("Anunțul nu a fost găsit pentru tenantul curent.");
    }
    return announcement;
  }

  private async assertTemplate(tenantId: string, id: string) {
    const template = await this.prisma.communicationTemplate.findFirst({ where: { id, tenantId, active: true } });
    if (!template) {
      throw new NotFoundException("Șablonul nu a fost găsit pentru tenantul curent.");
    }
    return template;
  }

  private async assertAudience(
    tenantId: string,
    audienceType: CommunicationAudienceType,
    audienceRefId?: string | null,
    targetEmployeeIds?: string[]
  ) {
    if (audienceType === CommunicationAudienceType.ALL) return;
    if (audienceType === CommunicationAudienceType.CUSTOM) {
      const ids = dedupe(targetEmployeeIds);
      if (!ids.length) throw new BadRequestException("Lista personalizată necesită cel puțin un angajat.");
      const count = await this.prisma.employee.count({ where: { tenantId, active: true, id: { in: ids } } });
      if (count !== ids.length) throw new NotFoundException("Unul sau mai mulți angajați selectați nu au fost găsiți pentru tenantul curent.");
      return;
    }
    if (!audienceRefId?.trim()) {
      throw new BadRequestException(`Audiența "${audienceLabel(audienceType)}" necesită selectarea unui segment.`);
    }
  }

  private async audienceCount(tenantId: string, row: CommunicationAnnouncement): Promise<number> {
    if (row.audienceType === CommunicationAudienceType.ALL) {
      return this.prisma.employee.count({ where: { tenantId, active: true } });
    }
    if (row.audienceType === CommunicationAudienceType.WORKSITE) {
      return this.prisma.employee.count({ where: { tenantId, active: true, worksiteId: row.audienceRefId } });
    }
    if (row.audienceType === CommunicationAudienceType.DEPARTMENT) {
      return this.prisma.employee.count({ where: { tenantId, active: true, departmentId: row.audienceRefId } });
    }
    if (row.audienceType === CommunicationAudienceType.JOB_POSITION) {
      return this.prisma.employee.count({ where: { tenantId, active: true, jobPositionId: row.audienceRefId } });
    }
    if (row.audienceType === CommunicationAudienceType.EMPLOYEE_GROUP) {
      return this.prisma.employeeGroupMember.count({
        where: { group: { id: row.audienceRefId ?? undefined, tenantId, active: true } }
      });
    }
    if (row.audienceType === CommunicationAudienceType.EMPLOYEE) {
      if (!row.audienceRefId) return 0;
      return this.prisma.employee.count({ where: { tenantId, active: true, id: row.audienceRefId } });
    }
    const ids = dedupe(row.targetEmployeeIds);
    return this.prisma.employee.count({ where: { tenantId, active: true, id: { in: ids } } });
  }

  private async withStats(tenantId: string, rows: CommunicationAnnouncement[]) {
    return Promise.all(
      rows.map(async (row) => {
        const [targetCount, readCount] = await Promise.all([
          this.audienceCount(tenantId, row),
          this.prisma.communicationAnnouncementRead.count({ where: { tenantId, announcementId: row.id } })
        ]);
        const unreadCount = Math.max(targetCount - readCount, 0);
        return {
          id: row.id,
          title: row.title,
          body: row.body,
          contentType: row.contentType,
          contentUrl: row.contentUrl,
          audienceType: row.audienceType,
          audienceRefId: row.audienceRefId,
          audienceLabel: row.audienceLabel,
          targetEmployeeIds: row.targetEmployeeIds,
          status: row.status,
          publishAt: row.publishAt,
          expiresAt: row.expiresAt,
          reminderAt: row.reminderAt,
          lastReminderSentAt: row.lastReminderSentAt,
          templateId: row.templateId,
          duplicatedFromId: row.duplicatedFromId,
          retractedAt: row.retractedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          stats: {
            targetCount,
            readCount,
            unreadCount,
            readRate: targetCount ? Math.round((readCount / targetCount) * 100) : 0
          }
        };
      })
    );
  }
}
