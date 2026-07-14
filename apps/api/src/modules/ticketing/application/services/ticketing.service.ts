import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { HelpdeskTicket, HelpdeskTicketPriority, HelpdeskTicketSource, HelpdeskTicketStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import {
  AddTicketCommentDto,
  AssignTicketDto,
  CreateTicketDto,
  ListTicketsDto,
  MoveTicketDto,
  UpdateTicketDto
} from "../../api/dto/ticketing.dto";
import { paginatedResult } from "../../../../common/pagination";
import { resolvePagination } from "../../../../common/dto/pagination-query.dto";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import {
  assertEmployeeInWorksiteScope,
  resolveWorksiteViewerScope,
  worksiteIdsFromScope,
  type WorksiteViewerScope
} from "../../../../common/worksite-viewer-scope";

const KANBAN_STATUSES = [
  HelpdeskTicketStatus.OPEN,
  HelpdeskTicketStatus.WAITING_OPERATOR,
  HelpdeskTicketStatus.WAITING_USER,
  HelpdeskTicketStatus.WAITING_INFO,
  HelpdeskTicketStatus.CLOSED
];

function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullable(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  return clean(value) ?? null;
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}

@Injectable()
export class TicketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly mailService: MailService
  ) {}

  async kanban(tenantId: string, query: ListTicketsDto, viewer?: JwtPayload) {
    const { items: tickets } = await this.findTicketsPaginated(
      tenantId,
      {
        ...query,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 100
      },
      viewer
    );
    return {
      columns: KANBAN_STATUSES.map((status) => ({
        status,
        tickets: tickets.filter((ticket) => ticket.status === status)
      }))
    };
  }

  async listTickets(tenantId: string, query: ListTicketsDto, viewer?: JwtPayload) {
    return this.findTicketsPaginated(tenantId, query, viewer);
  }

  async createTicket(tenantId: string, actorId: string, dto: CreateTicketDto, viewer?: JwtPayload) {
    const scope = await this.scopeFor(viewer, tenantId);
    await this.assertReporter(tenantId, dto.reporterEmployeeId, scope);
    await this.assertSurveyResponse(tenantId, dto.sourceSurveyResponseId);
    const ticket = await this.prisma.helpdeskTicket.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: clean(dto.category),
        priority: (dto.priority ?? HelpdeskTicketPriority.MEDIUM) as HelpdeskTicketPriority,
        source: (dto.source ??
          (dto.sourceSurveyResponseId ? HelpdeskTicketSource.SURVEY : HelpdeskTicketSource.PORTAL)) as HelpdeskTicketSource,
        reporterEmployeeId: clean(dto.reporterEmployeeId),
        reporterName: clean(dto.reporterName),
        reporterEmail: clean(dto.reporterEmail),
        assignedToUserId: clean(dto.assignedToUserId),
        assignedToName: clean(dto.assignedToName),
        sourceSurveyResponseId: clean(dto.sourceSurveyResponseId),
        dueAt: parseOptionalDate(dto.dueAt),
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "TICKETING",
      action: "TICKET_CREATED",
      entityType: "HelpdeskTicket",
      entityId: ticket.id,
      payload: { priority: ticket.priority, source: ticket.source }
    });
    await this.notifyTicketCreated(tenantId, ticket);
    return this.serializeTicket(ticket, 0);
  }

  async updateTicket(tenantId: string, actorId: string, id: string, dto: UpdateTicketDto) {
    const current = await this.assertTicket(tenantId, id);
    await this.assertReporter(tenantId, dto.reporterEmployeeId);
    const status = dto.status as HelpdeskTicketStatus | undefined;
    const resolvedAt =
      status === HelpdeskTicketStatus.WAITING_INFO && !current.resolvedAt ? new Date() : undefined;
    const closedAt = status === HelpdeskTicketStatus.CLOSED && !current.closedAt ? new Date() : undefined;
    const ticket = await this.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: cleanNullable(dto.category),
        status,
        priority: dto.priority as HelpdeskTicketPriority | undefined,
        reporterEmployeeId: cleanNullable(dto.reporterEmployeeId),
        reporterName: cleanNullable(dto.reporterName),
        reporterEmail: cleanNullable(dto.reporterEmail),
        assignedToUserId: cleanNullable(dto.assignedToUserId),
        assignedToName: cleanNullable(dto.assignedToName),
        dueAt: dto.dueAt === undefined ? undefined : parseOptionalDate(dto.dueAt) ?? null,
        resolvedAt,
        closedAt
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "TICKETING",
      action: "TICKET_UPDATED",
      entityType: "HelpdeskTicket",
      entityId: id
    });
    await this.notifyTicketUpdated(tenantId, current, ticket, dto);
    return this.serializeTicket(ticket, await this.commentCount(tenantId, id));
  }

  async moveTicket(tenantId: string, actorId: string, id: string, dto: MoveTicketDto) {
    return this.updateTicket(tenantId, actorId, id, { status: dto.status });
  }

  async assignTicket(tenantId: string, actorId: string, id: string, dto: AssignTicketDto) {
    return this.updateTicket(tenantId, actorId, id, {
      assignedToUserId: dto.assignedToUserId,
      assignedToName: dto.assignedToName
    });
  }

  async addComment(tenantId: string, actorId: string, ticketId: string, dto: AddTicketCommentDto) {
    await this.assertTicket(tenantId, ticketId);
    const comment = await this.prisma.helpdeskTicketComment.create({
      data: {
        tenantId,
        ticketId,
        body: dto.body.trim(),
        internal: dto.internal ?? false,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "TICKETING",
      action: "TICKET_COMMENT_ADDED",
      entityType: "HelpdeskTicket",
      entityId: ticketId,
      payload: { commentId: comment.id, internal: comment.internal }
    });
    if (!comment.internal) {
      const ticket = await this.assertTicket(tenantId, ticketId);
      await this.notifyTicketComment(tenantId, ticket, actorId, dto.body.trim());
    }
    return comment;
  }

  async comments(tenantId: string, ticketId: string) {
    await this.assertTicket(tenantId, ticketId);
    return {
      items: await this.prisma.helpdeskTicketComment.findMany({
        where: { tenantId, ticketId },
        orderBy: { createdAt: "asc" }
      })
    };
  }

  async stats(tenantId: string) {
    const now = new Date();
    const [total, open, overdue, byStatus, byPriority, byCategory, assignedRows] = await Promise.all([
      this.prisma.helpdeskTicket.count({ where: { tenantId } }),
      this.prisma.helpdeskTicket.count({
        where: { tenantId, status: { not: HelpdeskTicketStatus.CLOSED } }
      }),
      this.prisma.helpdeskTicket.count({
        where: {
          tenantId,
          dueAt: { lt: now },
          status: { not: HelpdeskTicketStatus.CLOSED }
        }
      }),
      this.prisma.helpdeskTicket.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
      this.prisma.helpdeskTicket.groupBy({ by: ["priority"], where: { tenantId }, _count: { _all: true } }),
      this.prisma.helpdeskTicket.groupBy({ by: ["category"], where: { tenantId }, _count: { _all: true } }),
      this.prisma.$queryRaw<
        Array<{ assignedToUserId: string; assignedToName: string | null; count: number }>
      >(Prisma.sql`
        SELECT "assignedToUserId", MAX("assignedToName") AS "assignedToName", COUNT(*)::int AS "count"
        FROM "HelpdeskTicket"
        WHERE "tenantId" = ${tenantId} AND "assignedToUserId" IS NOT NULL
        GROUP BY "assignedToUserId"
      `)
    ]);
    return {
      total,
      open,
      overdue,
      byStatus: KANBAN_STATUSES.map((status) => ({
        status,
        count: byStatus.find((item) => item.status === status)?._count._all ?? 0
      })),
      byPriority: Object.values(HelpdeskTicketPriority).map((priority) => ({
        priority,
        count: byPriority.find((item) => item.priority === priority)?._count._all ?? 0
      })),
      byCategory: byCategory.map((item) => ({
        category: item.category ?? "",
        count: item._count._all
      })),
      operators: assignedRows.map((item) => ({
        assignedToUserId: item.assignedToUserId,
        assignedToName: item.assignedToName,
        count: item.count
      }))
    };
  }

  private async scopeFor(viewer?: JwtPayload, tenantId?: string): Promise<WorksiteViewerScope> {
    if (!viewer || !tenantId) return { mode: "tenant" };
    return resolveWorksiteViewerScope(this.prisma, tenantId, viewer);
  }

  private applyWorksiteToTicketWhere(
    where: Prisma.HelpdeskTicketWhereInput,
    scope: WorksiteViewerScope
  ): Prisma.HelpdeskTicketWhereInput {
    const ids = worksiteIdsFromScope(scope);
    if (ids === null) return where;
    if (ids.length === 0) {
      return { ...where, id: "__worksite_scope_none__" };
    }
    const worksiteFilter =
      ids.length === 1 ? { worksiteId: ids[0] } : { worksiteId: { in: ids } };
    return {
      ...where,
      OR: [{ reporterEmployeeId: null }, { reporterEmployee: worksiteFilter }]
    };
  }

  private buildTicketWhere(tenantId: string, query: ListTicketsDto): Prisma.HelpdeskTicketWhereInput {
    const subjectTrim = clean(query.subject);
    const searchTrim = query.search?.trim();
    const assignedToNameTrim = clean(query.assignedToName);

    const textAnd: Prisma.HelpdeskTicketWhereInput[] = [];
    if (subjectTrim) {
      textAnd.push({ title: { contains: subjectTrim, mode: "insensitive" } });
    }
    if (searchTrim) {
      textAnd.push({
        OR: [
          { title: { contains: searchTrim, mode: "insensitive" } },
          { description: { contains: searchTrim, mode: "insensitive" } },
          { reporterName: { contains: searchTrim, mode: "insensitive" } },
          { reporterEmail: { contains: searchTrim, mode: "insensitive" } }
        ]
      });
    }

    const where: Prisma.HelpdeskTicketWhereInput = {
      tenantId,
      status: query.status as HelpdeskTicketStatus | undefined,
      priority: query.priority as HelpdeskTicketPriority | undefined,
      assignedToUserId: clean(query.assignedToUserId),
      reporterEmployeeId: clean(query.reporterEmployeeId),
      category: clean(query.category),
      assignedToName: assignedToNameTrim
        ? { contains: assignedToNameTrim, mode: "insensitive" }
        : undefined,
      AND: textAnd.length ? textAnd : undefined
    };
    return where;
  }

  private async findTicketsPaginated(tenantId: string, query: ListTicketsDto, viewer?: JwtPayload) {
    const p = resolvePagination(query);
    const scope = await this.scopeFor(viewer, tenantId);
    const where = this.applyWorksiteToTicketWhere(this.buildTicketWhere(tenantId, query), scope);
    const [rows, total] = await Promise.all([
      this.prisma.helpdeskTicket.findMany({
        where,
        include: { _count: { select: { comments: true } } },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.helpdeskTicket.count({ where })
    ]);
    const items = rows.map((ticket) => this.serializeTicket(ticket, ticket._count.comments));
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  private async assertTicket(tenantId: string, id: string) {
    const ticket = await this.prisma.helpdeskTicket.findFirst({ where: { tenantId, id } });
    if (!ticket) throw new NotFoundException("Ticket not found for tenant.");
    return ticket;
  }

  private async assertReporter(
    tenantId: string,
    employeeId?: string,
    scope: WorksiteViewerScope = { mode: "tenant" }
  ) {
    if (!employeeId) return;
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, id: employeeId, active: true } });
    if (!employee) throw new NotFoundException("Reporter employee not found for tenant.");
    await assertEmployeeInWorksiteScope(this.prisma, tenantId, employeeId, scope);
  }

  private async assertSurveyResponse(tenantId: string, surveyResponseId?: string) {
    if (!surveyResponseId) return;
    const response = await this.prisma.surveyResponse.findFirst({ where: { tenantId, id: surveyResponseId } });
    if (!response) throw new NotFoundException("Survey response not found for tenant.");
  }

  private async commentCount(tenantId: string, ticketId: string) {
    return this.prisma.helpdeskTicketComment.count({ where: { tenantId, ticketId } });
  }

  private serializeTicket(ticket: HelpdeskTicket, commentsCount: number) {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      source: ticket.source,
      reporterEmployeeId: ticket.reporterEmployeeId,
      reporterName: ticket.reporterName,
      reporterEmail: ticket.reporterEmail,
      assignedToUserId: ticket.assignedToUserId,
      assignedToName: ticket.assignedToName,
      sourceSurveyResponseId: ticket.sourceSurveyResponseId,
      dueAt: ticket.dueAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      createdBy: ticket.createdBy,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      commentsCount
    };
  }

  private ticketLink(ticketId: string) {
    return `/ticketing?ticket=${ticketId}`;
  }

  private portalTicketLink() {
    return "/portal?tab=tickets";
  }

  private async notifyTicketCreated(tenantId: string, ticket: HelpdeskTicket) {
    const title = `Tichet nou: ${ticket.title}`;
    const body = ticket.description.slice(0, 240);

    if (ticket.assignedToUserId) {
      await this.notifications.notifyUser({
        tenantId,
        userId: ticket.assignedToUserId,
        category: "TICKET_ASSIGNED",
        title,
        body: "Ai fost desemnat operator pe acest tichet.",
        linkPath: this.ticketLink(ticket.id),
        entityType: "HelpdeskTicket",
        entityId: ticket.id
      });
      await this.sendTicketEmail(tenantId, ticket.assignedToUserId, title, body);
    }

    if (ticket.reporterEmployeeId) {
      await this.notifications.notifyEmployee({
        tenantId,
        employeeId: ticket.reporterEmployeeId,
        category: "TICKET_CREATED",
        title: "Tichet înregistrat",
        body: `Solicitarea „${ticket.title}” a fost înregistrată.`,
        linkPath: this.portalTicketLink(),
        entityType: "HelpdeskTicket",
        entityId: ticket.id
      });
    } else if (ticket.reporterEmail) {
      await this.mailService.sendMail({
        to: ticket.reporterEmail,
        subject: title,
        text: `${body}\n\nPoți urmări statusul în platforma internă.`
      });
    }
  }

  private async notifyTicketUpdated(
    tenantId: string,
    previous: HelpdeskTicket,
    current: HelpdeskTicket,
    dto: UpdateTicketDto
  ) {
    const statusChanged = dto.status !== undefined && dto.status !== previous.status;
    const assigneeChanged =
      dto.assignedToUserId !== undefined && dto.assignedToUserId !== previous.assignedToUserId;

    if (assigneeChanged && current.assignedToUserId) {
      await this.notifications.notifyUser({
        tenantId,
        userId: current.assignedToUserId,
        category: "TICKET_ASSIGNED",
        title: `Tichet atribuit: ${current.title}`,
        body: "Ai fost desemnat operator pe acest tichet.",
        linkPath: this.ticketLink(current.id),
        entityType: "HelpdeskTicket",
        entityId: current.id
      });
      await this.sendTicketEmail(
        tenantId,
        current.assignedToUserId,
        `Tichet atribuit: ${current.title}`,
        current.description.slice(0, 240)
      );
    }

    if (statusChanged && current.reporterEmployeeId) {
      await this.notifications.notifyEmployee({
        tenantId,
        employeeId: current.reporterEmployeeId,
        category: "TICKET_STATUS",
        title: `Actualizare tichet: ${current.title}`,
        body: `Status nou: ${current.status.replaceAll("_", " ").toLowerCase()}.`,
        linkPath: this.portalTicketLink(),
        entityType: "HelpdeskTicket",
        entityId: current.id
      });
    } else if (statusChanged && current.reporterEmail) {
      await this.mailService.sendMail({
        to: current.reporterEmail,
        subject: `Actualizare tichet: ${current.title}`,
        text: `Status nou: ${current.status}`
      });
    }
  }

  private async notifyTicketComment(
    tenantId: string,
    ticket: HelpdeskTicket,
    actorId: string,
    commentBody: string
  ) {
    const snippet = commentBody.slice(0, 200);
    const targets = new Set<string>();

    if (ticket.assignedToUserId && ticket.assignedToUserId !== actorId) {
      targets.add(ticket.assignedToUserId);
    }
    if (ticket.createdBy !== actorId) {
      targets.add(ticket.createdBy);
    }

    for (const userId of targets) {
      await this.notifications.notifyUser({
        tenantId,
        userId,
        category: "TICKET_COMMENT",
        title: `Comentariu nou: ${ticket.title}`,
        body: snippet,
        linkPath: this.ticketLink(ticket.id),
        entityType: "HelpdeskTicket",
        entityId: ticket.id
      });
      await this.sendTicketEmail(tenantId, userId, `Comentariu nou: ${ticket.title}`, snippet);
    }

    if (ticket.reporterEmployeeId) {
      const reporterUserId = await this.notifications.findUserIdForEmployee(
        tenantId,
        ticket.reporterEmployeeId
      );
      if (!reporterUserId || reporterUserId === actorId) {
        return;
      }
      await this.notifications.notifyUser({
        tenantId,
        userId: reporterUserId,
        category: "TICKET_COMMENT",
        title: `Răspuns la tichet: ${ticket.title}`,
        body: snippet,
        linkPath: this.portalTicketLink(),
        entityType: "HelpdeskTicket",
        entityId: ticket.id
      });
    }
  }

  private async sendTicketEmail(tenantId: string, userId: string, subject: string, text: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
      select: { email: true }
    });
    if (!user?.email) return;
    await this.mailService.sendMail({
      to: user.email,
      subject,
      text: `${text}\n\nDeschide platforma pentru detalii.`
    });
  }
}
