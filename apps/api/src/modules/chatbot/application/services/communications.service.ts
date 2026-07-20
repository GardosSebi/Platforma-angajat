import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommunicationAnnouncement,
  CommunicationAnnouncementStatus,
  CommunicationAudienceType,
  CommunicationCategory,
  CommunicationContentType,
  CommunicationMessageType,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import { PaginationQueryDto, resolvePagination } from "../../../../common/dto/pagination-query.dto";
import { paginatedResult } from "../../../../common/pagination";
import {
  CreateAnnouncementDto,
  CreateTemplateDto,
  MarkAnnouncementReadDto,
  SetAnnouncementReactionDto,
  UpdateAnnouncementDto
} from "../../api/dto/communications.dto";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import {
  applyWorksiteToEmployeeWhere,
  assertEmployeeInWorksiteScope,
  employeeIdsInWorksiteScope,
  resolveWorksiteViewerScope,
  worksiteIdsFromScope,
  type WorksiteViewerScope
} from "../../../../common/worksite-viewer-scope";
import { CommunicationRightsService } from "./communication-rights.service";

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
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED" | "READY_TO_SEND" | undefined,
  publishAt?: Date | null
): CommunicationAnnouncementStatus {
  if (status === "DRAFT") return CommunicationAnnouncementStatus.DRAFT;
  if (status === "READY_TO_SEND") return CommunicationAnnouncementStatus.READY_TO_SEND;
  if (status === "ARCHIVED") return CommunicationAnnouncementStatus.ARCHIVED;
  if (publishAt && publishAt.getTime() > Date.now()) return CommunicationAnnouncementStatus.SCHEDULED;
  return status === "SCHEDULED" ? CommunicationAnnouncementStatus.SCHEDULED : CommunicationAnnouncementStatus.PUBLISHED;
}

function jsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly publishRights: CommunicationRightsService
  ) {}

  private async scopeFor(viewer?: JwtPayload, tenantId?: string): Promise<WorksiteViewerScope> {
    if (!viewer || !tenantId) return { mode: "tenant" };
    return resolveWorksiteViewerScope(this.prisma, tenantId, viewer);
  }

  async dashboard(tenantId: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const employeeWhere = applyWorksiteToEmployeeWhere({ tenantId, active: true }, scope);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeEmployees, activeUsers, announcements, latest, calendarRows] = await Promise.all([
      this.prisma.employee.count({ where: employeeWhere }),
      this.prisma.user.count({
        where: { tenantId, active: true, lastLoginAt: { gte: thirtyDaysAgo } }
      }),
      this.prisma.communicationAnnouncement.findMany({
        where: { tenantId, status: { in: [CommunicationAnnouncementStatus.PUBLISHED, CommunicationAnnouncementStatus.SCHEDULED] } },
        include: { readReceipts: { select: { employeeId: true } } }
      }),
      this.prisma.communicationAnnouncement.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.communicationAnnouncement.findMany({
        where: {
          tenantId,
          publishAt: { not: null },
          status: { in: [CommunicationAnnouncementStatus.SCHEDULED, CommunicationAnnouncementStatus.READY_TO_SEND, CommunicationAnnouncementStatus.PUBLISHED] }
        },
        orderBy: { publishAt: "asc" },
        take: 60
      })
    ]);

    const activeAnnouncements = announcements.filter((item) => item.status === CommunicationAnnouncementStatus.PUBLISHED).length;
    const scheduledAnnouncements = announcements.filter((item) => item.status === CommunicationAnnouncementStatus.SCHEDULED).length;
    const employeesWithAccounts = await this.prisma.employee.count({
      where: {
        ...employeeWhere,
        email: { not: "" }
      }
    });
    const digitalizationRate = employeesWithAccounts
      ? Math.round((activeUsers / employeesWithAccounts) * 100)
      : 0;
    const latestAnnouncements = await this.withStats(tenantId, latest, scope);
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
        digitalizationRate,
        activeEmployees,
        activeUsers,
        activeAnnouncements,
        scheduledAnnouncements,
        readRate: totals.targetCount ? Math.round((totals.readCount / totals.targetCount) * 100) : 0,
        unreadEstimate: totals.unreadCount
      },
      latestAnnouncements,
      reminders: await this.reminders(tenantId, viewer),
      calendar: calendarRows
        .filter((row) => row.publishAt)
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          publishAt: row.publishAt!.toISOString(),
          audienceLabel: row.audienceLabel
        }))
    };
  }

  async calendar(tenantId: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const rows = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        publishAt: { not: null },
        status: {
          in: [
            CommunicationAnnouncementStatus.SCHEDULED,
            CommunicationAnnouncementStatus.READY_TO_SEND,
            CommunicationAnnouncementStatus.PUBLISHED
          ]
        }
      },
      orderBy: { publishAt: "asc" },
      take: 120
    });
    const scoped = await this.filterAnnouncementsForScope(tenantId, rows, scope);
    return {
      items: scoped
        .filter((row) => row.publishAt)
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          publishAt: row.publishAt!.toISOString(),
          audienceLabel: row.audienceLabel
        }))
    };
  }

  async listAnnouncements(tenantId: string, query?: PaginationQueryDto, viewer?: JwtPayload) {
    const p = resolvePagination(query);
    const scope = await this.scopeFor(viewer, tenantId);
    const allRows = await this.prisma.communicationAnnouncement.findMany({
      where: { tenantId },
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }]
    });
    const scopedRows = await this.filterAnnouncementsForScope(tenantId, allRows, scope);
    const pageRows = scopedRows.slice(p.skip, p.skip + p.take);
    const items = await this.withStats(tenantId, pageRows, scope);
    return paginatedResult(items, scopedRows.length, p.page, p.pageSize);
  }

  async createAnnouncement(tenantId: string, actorId: string, dto: CreateAnnouncementDto, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    await this.assertAudience(tenantId, dto.audienceType, dto.audienceRefId, dto.targetEmployeeIds, scope);
    if (viewer) {
      await this.publishRights.assertCanPublish(
        tenantId,
        viewer.sub,
        viewer.roles ?? [],
        dto.audienceType,
        dto.audienceRefId
      );
    }
    if (dto.templateId) {
      await this.assertTemplate(tenantId, dto.templateId);
    }

    const publishAt = parseOptionalDate(dto.publishAt);
    const messageType = (dto.messageType ?? "ANNOUNCEMENT") as CommunicationMessageType;
    const requireRead =
      dto.requireReadConfirmation ?? messageType === "READ_CONFIRMATION";
    const created = await this.prisma.communicationAnnouncement.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        category: dto.category ?? CommunicationCategory.GENERAL,
        contentType: dto.contentType ?? CommunicationContentType.TEXT,
        contentUrl: clean(dto.contentUrl),
        messageType,
        requireReadConfirmation: requireRead,
        linkedSurveyId: clean(dto.linkedSurveyId),
        buttonLabel: clean(dto.buttonLabel),
        buttonUrl: clean(dto.buttonUrl),
        translations: dto.translations ? jsonValue(dto.translations) : undefined,
        reactionsEnabled: dto.reactionsEnabled ?? false,
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

    if (created.status === CommunicationAnnouncementStatus.PUBLISHED) {
      await this.notifyAnnouncementAudience(tenantId, created);
    }

    return this.getAnnouncement(tenantId, created.id, viewer);
  }

  async updateAnnouncement(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateAnnouncementDto,
    viewer?: JwtPayload
  ) {
    const scope = await this.scopeFor(viewer, tenantId);
    const current = await this.assertAnnouncementVisible(tenantId, id, scope);
    const audienceType = dto.audienceType ?? current.audienceType;
    const audienceRefId = dto.audienceRefId ?? current.audienceRefId ?? undefined;
    const targetEmployeeIds = dto.targetEmployeeIds ?? current.targetEmployeeIds;
    await this.assertAudience(tenantId, audienceType, audienceRefId, targetEmployeeIds, scope);

    const publishAt = dto.publishAt === undefined ? current.publishAt : parseOptionalDate(dto.publishAt);
    const data = {
      title: dto.title?.trim(),
      body: dto.body?.trim(),
      category: dto.category,
      contentType: dto.contentType,
      contentUrl: dto.contentUrl === undefined ? undefined : clean(dto.contentUrl) ?? null,
      messageType: dto.messageType as CommunicationMessageType | undefined,
      requireReadConfirmation: dto.requireReadConfirmation,
      linkedSurveyId: dto.linkedSurveyId === undefined ? undefined : clean(dto.linkedSurveyId) ?? null,
      buttonLabel: dto.buttonLabel === undefined ? undefined : clean(dto.buttonLabel) ?? null,
      buttonUrl: dto.buttonUrl === undefined ? undefined : clean(dto.buttonUrl) ?? null,
      translations: dto.translations === undefined ? undefined : jsonValue(dto.translations),
      reactionsEnabled: dto.reactionsEnabled,
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

    return this.getAnnouncement(tenantId, id, viewer);
  }

  async publishAnnouncement(tenantId: string, actorId: string, id: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const current = await this.assertAnnouncementVisible(tenantId, id, scope);
    if (viewer) {
      await this.publishRights.assertCanPublish(
        tenantId,
        viewer.sub,
        viewer.roles ?? [],
        current.audienceType,
        current.audienceRefId
      );
    }
    const status = statusForPublish("PUBLISHED", current.publishAt ?? undefined);
    await this.prisma.communicationAnnouncement.update({ where: { id }, data: { status, retractedAt: null } });
    if (status === CommunicationAnnouncementStatus.PUBLISHED) {
      await this.notifyAnnouncementAudience(tenantId, { ...current, status });
    }
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_PUBLISHED",
      entityType: "CommunicationAnnouncement",
      entityId: id,
      payload: { status }
    });
    return this.getAnnouncement(tenantId, id, viewer);
  }

  async retractAnnouncement(tenantId: string, actorId: string, id: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    await this.assertAnnouncementVisible(tenantId, id, scope);
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
    return this.getAnnouncement(tenantId, id, viewer);
  }

  async duplicateAnnouncement(tenantId: string, actorId: string, id: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const source = await this.assertAnnouncementVisible(tenantId, id, scope);
    const duplicated = await this.prisma.communicationAnnouncement.create({
      data: {
        tenantId,
        title: `${source.title} (copie)`,
        body: source.body,
        category: source.category,
        contentType: source.contentType,
        contentUrl: source.contentUrl,
        messageType: source.messageType,
        requireReadConfirmation: source.requireReadConfirmation,
        linkedSurveyId: source.linkedSurveyId,
        buttonLabel: source.buttonLabel,
        buttonUrl: source.buttonUrl,
        translations: source.translations === null ? undefined : (source.translations as Prisma.InputJsonValue),
        reactionsEnabled: source.reactionsEnabled,
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
    return this.getAnnouncement(tenantId, duplicated.id, viewer);
  }

  async markRead(tenantId: string, announcementId: string, dto: MarkAnnouncementReadDto, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    await this.assertAnnouncementVisible(tenantId, announcementId, scope);
    await assertEmployeeInWorksiteScope(this.prisma, tenantId, dto.employeeId, scope);
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

  async setReaction(
    tenantId: string,
    announcementId: string,
    dto: SetAnnouncementReactionDto,
    viewer?: JwtPayload
  ) {
    const scope = await this.scopeFor(viewer, tenantId);
    const announcement = await this.assertAnnouncementVisible(tenantId, announcementId, scope);
    if (!announcement.reactionsEnabled) {
      throw new BadRequestException("Reacțiile nu sunt activate pentru acest anunț.");
    }
    await assertEmployeeInWorksiteScope(this.prisma, tenantId, dto.employeeId, scope);
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, active: true } });
    if (!employee) {
      throw new NotFoundException("Angajatul nu a fost găsit pentru tenantul curent.");
    }
    return this.prisma.communicationAnnouncementReaction.upsert({
      where: { announcementId_employeeId: { announcementId, employeeId: employee.id } },
      create: { tenantId, announcementId, employeeId: employee.id, reaction: dto.reaction },
      update: { reaction: dto.reaction, createdAt: new Date() }
    });
  }

  async publishDueScheduled(tenantId: string, actorId: string) {
    const now = new Date();
    const due = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        status: CommunicationAnnouncementStatus.SCHEDULED,
        publishAt: { lte: now }
      }
    });

    for (const item of due) {
      await this.prisma.communicationAnnouncement.update({
        where: { id: item.id },
        data: { status: CommunicationAnnouncementStatus.PUBLISHED }
      });
      await this.notifyAnnouncementAudience(tenantId, item);
    }

    if (due.length) {
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "COMMUNICATIONS",
        action: "SCHEDULED_ANNOUNCEMENTS_PUBLISHED",
        entityType: "CommunicationAnnouncement",
        entityId: "batch",
        payload: { published: due.length }
      });
    }

    return { published: due.length };
  }

  /** Arhivează anunțurile publicate după data de expirare. */
  async archiveExpiredAnnouncements(tenantId: string, actorId: string) {
    const now = new Date();
    const due = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        status: CommunicationAnnouncementStatus.PUBLISHED,
        expiresAt: { lte: now }
      }
    });
    for (const item of due) {
      await this.prisma.communicationAnnouncement.update({
        where: { id: item.id },
        data: { status: CommunicationAnnouncementStatus.ARCHIVED }
      });
    }
    if (due.length) {
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "COMMUNICATIONS",
        action: "ANNOUNCEMENTS_EXPIRED_ARCHIVED",
        entityType: "CommunicationAnnouncement",
        entityId: "batch",
        payload: { archived: due.length }
      });
    }
    return { archived: due.length };
  }

  async reminders(tenantId: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const rows = await this.prisma.communicationAnnouncement.findMany({
      where: {
        tenantId,
        reminderAt: { not: null },
        status: { in: [CommunicationAnnouncementStatus.PUBLISHED, CommunicationAnnouncementStatus.SCHEDULED] }
      },
      orderBy: { reminderAt: "asc" },
      take: 80
    });
    const scopedRows = await this.filterAnnouncementsForScope(tenantId, rows, scope);
    const withStats = await this.withStats(tenantId, scopedRows, scope);
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

  async createTemplate(tenantId: string, actorId: string, dto: CreateTemplateDto, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    if (viewer) {
      await this.publishRights.assertCanManageTemplates(tenantId, viewer.sub, viewer.roles ?? []);
    }
    await this.assertAudience(
      tenantId,
      dto.audienceType ?? CommunicationAudienceType.ALL,
      dto.audienceRefId,
      undefined,
      scope
    );
    const created = await this.prisma.communicationTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        category: dto.category ?? CommunicationCategory.GENERAL,
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

  private async resolveAudienceEmployeeIds(tenantId: string, row: CommunicationAnnouncement): Promise<string[]> {
    if (row.audienceType === CommunicationAudienceType.ALL) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (row.audienceType === CommunicationAudienceType.WORKSITE) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, worksiteId: row.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (row.audienceType === CommunicationAudienceType.DEPARTMENT) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, departmentId: row.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (row.audienceType === CommunicationAudienceType.JOB_POSITION) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, jobPositionId: row.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (row.audienceType === CommunicationAudienceType.EMPLOYEE_GROUP) {
      const rows = await this.prisma.employeeGroupMember.findMany({
        where: { group: { id: row.audienceRefId ?? undefined, tenantId, active: true } },
        select: { employeeId: true }
      });
      return rows.map((item) => item.employeeId);
    }
    if (row.audienceType === CommunicationAudienceType.EMPLOYEE) {
      return row.audienceRefId ? [row.audienceRefId] : [];
    }
    return dedupe(row.targetEmployeeIds);
  }

  private async notifyAnnouncementAudience(tenantId: string, row: CommunicationAnnouncement) {
    const employeeIds = await this.resolveAudienceEmployeeIds(tenantId, row);
    for (const employeeId of employeeIds) {
      await this.notifications.notifyEmployee({
        tenantId,
        employeeId,
        category: "COMMUNICATION",
        title: `Anunț: ${row.title}`,
        body: row.body.length > 240 ? `${row.body.slice(0, 240)}…` : row.body,
        linkPath: "/chatbot",
        entityType: "CommunicationAnnouncement",
        entityId: row.id
      });
    }
  }

  async getAnnouncement(tenantId: string, id: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const row = await this.assertAnnouncementVisible(tenantId, id, scope);
    const [item] = await this.withStats(tenantId, [row], scope);
    return item;
  }

  async deleteAnnouncement(tenantId: string, actorId: string, id: string, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    const current = await this.assertAnnouncementVisible(tenantId, id, scope);
    const deletable: CommunicationAnnouncementStatus[] = [
      CommunicationAnnouncementStatus.DRAFT,
      CommunicationAnnouncementStatus.READY_TO_SEND,
      CommunicationAnnouncementStatus.RETRACTED,
      CommunicationAnnouncementStatus.ARCHIVED
    ];
    if (!deletable.includes(current.status)) {
      throw new BadRequestException(
        "Doar ciornele, anunțurile gata de trimis, retrase sau arhivate pot fi șterse. Retrage mai întâi anunțurile publicate."
      );
    }
    await this.prisma.communicationAnnouncement.delete({ where: { id } });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "ANNOUNCEMENT_DELETED",
      entityType: "CommunicationAnnouncement",
      entityId: id,
      payload: { status: current.status, title: current.title }
    });
    return { ok: true };
  }

  private async assertAnnouncement(tenantId: string, id: string) {
    const announcement = await this.prisma.communicationAnnouncement.findFirst({ where: { id, tenantId } });
    if (!announcement) {
      throw new NotFoundException("Anunțul nu a fost găsit pentru tenantul curent.");
    }
    return announcement;
  }

  private async assertAnnouncementVisible(
    tenantId: string,
    id: string,
    scope: WorksiteViewerScope
  ) {
    const announcement = await this.assertAnnouncement(tenantId, id);
    if (worksiteIdsFromScope(scope) === null) {
      return announcement;
    }
    const visible = await this.filterAnnouncementsForScope(tenantId, [announcement], scope);
    if (!visible.length) {
      throw new NotFoundException("Anunțul nu a fost găsit pentru tenantul curent.");
    }
    return announcement;
  }

  private async filterAnnouncementsForScope(
    tenantId: string,
    rows: CommunicationAnnouncement[],
    scope: WorksiteViewerScope
  ) {
    const scopedIds = worksiteIdsFromScope(scope);
    if (scopedIds === null) {
      return rows;
    }
    const allowedEmployeeIds = new Set(await employeeIdsInWorksiteScope(this.prisma, tenantId, scope));
    const filtered: CommunicationAnnouncement[] = [];
    for (const row of rows) {
      const targets = await this.resolveAudienceEmployeeIds(tenantId, row);
      if (targets.some((id) => allowedEmployeeIds.has(id))) {
        filtered.push(row);
      }
    }
    return filtered;
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
    targetEmployeeIds?: string[],
    scope: WorksiteViewerScope = { mode: "tenant" }
  ) {
    const scopedIds = worksiteIdsFromScope(scope);
    if (scopedIds !== null) {
      if (audienceType === CommunicationAudienceType.ALL) {
        throw new ForbiddenException(
          "Nu poți trimite anunțuri către toți angajații. Audiența este limitată la punctul tău de lucru."
        );
      }
    }

    if (audienceType === CommunicationAudienceType.ALL) return;
    if (audienceType === CommunicationAudienceType.CUSTOM) {
      const ids = dedupe(targetEmployeeIds);
      if (!ids.length) throw new BadRequestException("Lista personalizată necesită cel puțin un angajat.");
      const count = await this.prisma.employee.count({
        where: applyWorksiteToEmployeeWhere({ tenantId, active: true, id: { in: ids } }, scope)
      });
      if (count !== ids.length) {
        throw new NotFoundException(
          "Unul sau mai mulți angajați selectați nu aparțin punctului tău de lucru sau nu au fost găsiți."
        );
      }
      return;
    }
    if (!audienceRefId?.trim()) {
      throw new BadRequestException(`Audiența "${audienceLabel(audienceType)}" necesită selectarea unui segment.`);
    }

    if (scopedIds !== null) {
      if (audienceType === CommunicationAudienceType.WORKSITE) {
        if (!scopedIds.includes(audienceRefId.trim())) {
          throw new ForbiddenException("Poți publica anunțuri doar pentru propriul punct de lucru.");
        }
        return;
      }
      if (audienceType === CommunicationAudienceType.DEPARTMENT) {
        const dep = await this.prisma.department.findFirst({
          where: { id: audienceRefId.trim(), tenantId }
        });
        if (!dep?.worksiteId || !scopedIds.includes(dep.worksiteId)) {
          throw new ForbiddenException("Departamentul selectat nu aparține punctului tău de lucru.");
        }
        return;
      }
      if (audienceType === CommunicationAudienceType.JOB_POSITION) {
        const job = await this.prisma.jobPosition.findFirst({
          where: { id: audienceRefId.trim(), tenantId },
          include: { department: { select: { worksiteId: true } } }
        });
        const wsId = job?.department?.worksiteId;
        if (!wsId || !scopedIds.includes(wsId)) {
          throw new ForbiddenException("Postul selectat nu aparține punctului tău de lucru.");
        }
        return;
      }
      if (audienceType === CommunicationAudienceType.EMPLOYEE) {
        await assertEmployeeInWorksiteScope(this.prisma, tenantId, audienceRefId.trim(), scope);
        return;
      }
      if (audienceType === CommunicationAudienceType.EMPLOYEE_GROUP) {
        const members = await this.prisma.employeeGroupMember.findMany({
          where: { groupId: audienceRefId.trim() },
          include: { employee: { select: { worksiteId: true, active: true } } }
        });
        const activeMembers = members.filter((m) => m.employee.active);
        if (
          !activeMembers.length ||
          activeMembers.some((m) => !m.employee.worksiteId || !scopedIds.includes(m.employee.worksiteId))
        ) {
          throw new ForbiddenException("Grupul conține angajați din afara punctului tău de lucru.");
        }
        return;
      }
    }
  }

  private async audienceCount(
    tenantId: string,
    row: CommunicationAnnouncement,
    scope: WorksiteViewerScope = { mode: "tenant" }
  ): Promise<number> {
    const allTargets = await this.resolveAudienceEmployeeIds(tenantId, row);
    const scopedIds = worksiteIdsFromScope(scope);
    if (scopedIds === null) {
      return allTargets.length;
    }
    const allowed = new Set(await employeeIdsInWorksiteScope(this.prisma, tenantId, scope));
    return allTargets.filter((id) => allowed.has(id)).length;
  }

  private async withStats(
    tenantId: string,
    rows: CommunicationAnnouncement[],
    scope: WorksiteViewerScope = { mode: "tenant" }
  ) {
    const creatorIds = [...new Set(rows.map((r) => r.createdBy))];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({
          where: { tenantId, id: { in: creatorIds } },
          select: { id: true, fullName: true, email: true }
        })
      : [];
    const creatorById = new Map(creators.map((u) => [u.id, u]));

    return Promise.all(
      rows.map(async (row) => {
        const [targetCount, readCount, reactionCount] = await Promise.all([
          this.audienceCount(tenantId, row, scope),
          this.prisma.communicationAnnouncementRead.count({ where: { tenantId, announcementId: row.id } }),
          this.prisma.communicationAnnouncementReaction.count({ where: { tenantId, announcementId: row.id } })
        ]);
        const unreadCount = Math.max(targetCount - readCount, 0);
        const creator = creatorById.get(row.createdBy);
        return {
          id: row.id,
          title: row.title,
          body: row.body,
          category: row.category,
          contentType: row.contentType,
          contentUrl: row.contentUrl,
          messageType: row.messageType,
          requireReadConfirmation: row.requireReadConfirmation,
          linkedSurveyId: row.linkedSurveyId,
          buttonLabel: row.buttonLabel,
          buttonUrl: row.buttonUrl,
          translations: row.translations,
          reactionsEnabled: row.reactionsEnabled,
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
          createdBy: row.createdBy,
          createdByName: creator?.fullName ?? creator?.email ?? null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          stats: {
            targetCount,
            readCount,
            unreadCount,
            readRate: targetCount ? Math.round((readCount / targetCount) * 100) : 0,
            reactionCount
          }
        };
      })
    );
  }
}
