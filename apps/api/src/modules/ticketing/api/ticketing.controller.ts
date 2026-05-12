import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { TicketingService } from "../application/services/ticketing.service";
import {
  AddTicketCommentDto,
  AssignTicketDto,
  CreateTicketDto,
  ListTicketsDto,
  MoveTicketDto,
  UpdateTicketDto
} from "./dto/ticketing.dto";

@Controller("ticketing")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TicketingController {
  constructor(private readonly ticketing: TicketingService) {}

  @Get("health")
  health() {
    return { module: "ticketing", status: "ok" };
  }

  @Get("kanban")
  @RequirePermissions(Permission.TICKETS_VIEW)
  kanban(@TenantId() tenantId: string, @Query() query: ListTicketsDto) {
    return this.ticketing.kanban(tenantId, query);
  }

  @Get("tickets")
  @RequirePermissions(Permission.TICKETS_VIEW)
  listTickets(@TenantId() tenantId: string, @Query() query: ListTicketsDto) {
    return this.ticketing.listTickets(tenantId, query);
  }

  @Post("tickets")
  @RequirePermissions(Permission.TICKETS_EDIT)
  createTicket(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateTicketDto) {
    return this.ticketing.createTicket(tenantId, user.sub, dto);
  }

  @Post("tickets/from-survey-response")
  @RequirePermissions(Permission.TICKETS_EDIT)
  createTicketFromSurvey(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateTicketDto) {
    return this.ticketing.createTicket(tenantId, user.sub, { ...dto, source: "SURVEY" });
  }

  @Patch("tickets/:id")
  @RequirePermissions(Permission.TICKETS_EDIT)
  updateTicket(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateTicketDto
  ) {
    return this.ticketing.updateTicket(tenantId, user.sub, id, dto);
  }

  @Patch("tickets/:id/move")
  @RequirePermissions(Permission.TICKETS_EDIT)
  moveTicket(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: MoveTicketDto) {
    return this.ticketing.moveTicket(tenantId, user.sub, id, dto);
  }

  @Patch("tickets/:id/assign")
  @RequirePermissions(Permission.TICKETS_ASSIGN)
  assignTicket(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: AssignTicketDto
  ) {
    return this.ticketing.assignTicket(tenantId, user.sub, id, dto);
  }

  @Get("tickets/:id/comments")
  @RequirePermissions(Permission.TICKETS_VIEW)
  comments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.ticketing.comments(tenantId, id);
  }

  @Post("tickets/:id/comments")
  @RequirePermissions(Permission.TICKETS_EDIT)
  addComment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: AddTicketCommentDto
  ) {
    return this.ticketing.addComment(tenantId, user.sub, id, dto);
  }

  @Get("stats")
  @RequirePermissions(Permission.TICKETS_STATS)
  stats(@TenantId() tenantId: string) {
    return this.ticketing.stats(tenantId);
  }
}
