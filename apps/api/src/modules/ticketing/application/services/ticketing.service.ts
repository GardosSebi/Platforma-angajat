import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { HelpdeskTicket, HelpdeskTicketPriority, HelpdeskTicketSource, HelpdeskTicketStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  AddTicketCommentDto,
  AssignTicketDto,
  CreateTicketDto,
  ListTicketsDto,
  MoveTicketDto,
  UpdateTicketDto
} from "../../api/dto/ticketing.dto";

const KANBAN_STATUSES = [
  HelpdeskTicketStatus.NEW,
  HelpdeskTicketStatus.TRIAGE,
  HelpdeskTicketStatus.IN_PROGRESS,
  HelpdeskTicketStatus.WAITING_REQUESTER,
  HelpdeskTicketStatus.RESOLVED,
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
    private readonly auditLog: AuditLogService
  ) {}

  async kanban(tenantId: string, query: ListTicketsDto) {
    const tickets = await this.findTickets(tenantId, query);
    return {
      columns: KANBAN_STATUSES.map((status) => ({
        status,
        tickets: tickets.filter((ticket) => ticket.status === status)
      }))
    };
  }

  async listTickets(tenantId: string, query: ListTicketsDto) {
    return { items: await this.findTickets(tenantId, query) };
  }

  async createTicket(tenantId: string, actorId: string, dto: CreateTicketDto) {
    await this.assertReporter(tenantId, dto.reporterEmployeeId);
    await this.assertSurveyResponse(tenantId, dto.sourceSurveyResponseId);
    const ticket = await this.prisma.helpdeskTicket.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: clean(dto.category),
        priority: dto.priority ?? HelpdeskTicketPriority.MEDIUM,
        source: dto.source ?? (dto.sourceSurveyResponseId ? HelpdeskTicketSource.SURVEY : HelpdeskTicketSource.PORTAL),
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
    return this.serializeTicket(ticket, 0);
  }

  async updateTicket(tenantId: string, actorId: string, id: string, dto: UpdateTicketDto) {
    const current = await this.assertTicket(tenantId, id);
    await this.assertReporter(tenantId, dto.reporterEmployeeId);
    const status = dto.status;
    const resolvedAt = status === HelpdeskTicketStatus.RESOLVED && !current.resolvedAt ? new Date() : undefined;
    const closedAt = status === HelpdeskTicketStatus.CLOSED && !current.closedAt ? new Date() : undefined;
    const ticket = await this.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: cleanNullable(dto.category),
        status,
        priority: dto.priority,
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
    const [total, open, overdue, byStatus, byPriority, assigned] = await Promise.all([
      this.prisma.helpdeskTicket.count({ where: { tenantId } }),
      this.prisma.helpdeskTicket.count({
        where: { tenantId, status: { notIn: [HelpdeskTicketStatus.RESOLVED, HelpdeskTicketStatus.CLOSED] } }
      }),
      this.prisma.helpdeskTicket.count({
        where: {
          tenantId,
          dueAt: { lt: now },
          status: { notIn: [HelpdeskTicketStatus.RESOLVED, HelpdeskTicketStatus.CLOSED] }
        }
      }),
      this.prisma.helpdeskTicket.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
      this.prisma.helpdeskTicket.groupBy({ by: ["priority"], where: { tenantId }, _count: { _all: true } }),
      this.prisma.helpdeskTicket.groupBy({
        by: ["assignedToUserId", "assignedToName"],
        where: { tenantId, assignedToUserId: { not: null } },
        _count: { _all: true }
      })
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
      operators: assigned.map((item) => ({
        assignedToUserId: item.assignedToUserId ?? "",
        assignedToName: item.assignedToName,
        count: item._count._all
      }))
    };
  }

  private async findTickets(tenantId: string, query: ListTicketsDto) {
    const where: Prisma.HelpdeskTicketWhereInput = {
      tenantId,
      status: query.status,
      priority: query.priority,
      assignedToUserId: clean(query.assignedToUserId),
      reporterEmployeeId: clean(query.reporterEmployeeId),
      category: clean(query.category),
      OR: query.search?.trim()
        ? [
            { title: { contains: query.search.trim(), mode: "insensitive" } },
            { description: { contains: query.search.trim(), mode: "insensitive" } },
            { reporterName: { contains: query.search.trim(), mode: "insensitive" } },
            { reporterEmail: { contains: query.search.trim(), mode: "insensitive" } }
          ]
        : undefined
    };
    const rows = await this.prisma.helpdeskTicket.findMany({
      where,
      include: { _count: { select: { comments: true } } },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 300
    });
    return rows.map((ticket) => this.serializeTicket(ticket, ticket._count.comments));
  }

  private async assertTicket(tenantId: string, id: string) {
    const ticket = await this.prisma.helpdeskTicket.findFirst({ where: { tenantId, id } });
    if (!ticket) throw new NotFoundException("Ticket not found for tenant.");
    return ticket;
  }

  private async assertReporter(tenantId: string, employeeId?: string) {
    if (!employeeId) return;
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, id: employeeId, active: true } });
    if (!employee) throw new NotFoundException("Reporter employee not found for tenant.");
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
}
