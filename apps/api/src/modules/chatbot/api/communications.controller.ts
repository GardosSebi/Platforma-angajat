import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CommunicationsService } from "../application/services/communications.service";
import {
  CreateAnnouncementDto,
  CreateTemplateDto,
  MarkAnnouncementReadDto,
  SetAnnouncementReactionDto,
  UpdateAnnouncementDto
} from "./dto/communications.dto";

@Controller("chatbot")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get("health")
  health() {
    return { module: "chatbot", status: "ok" };
  }

  @Get("overview")
  @RequirePermissions(Permission.COMMUNICATIONS_DASHBOARD_VIEW)
  dashboard(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.communications.dashboard(tenantId, user);
  }

  @Get("announcements")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  listAnnouncements(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto
  ) {
    return this.communications.listAnnouncements(tenantId, query, user);
  }

  @Get("announcements/:id")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  getAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communications.getAnnouncement(tenantId, id, user);
  }

  @Post("announcements")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  createAnnouncement(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAnnouncementDto
  ) {
    return this.communications.createAnnouncement(tenantId, user.sub, dto, user);
  }

  @Patch("announcements/:id")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  updateAnnouncement(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAnnouncementDto
  ) {
    return this.communications.updateAnnouncement(tenantId, user.sub, id, dto, user);
  }

  @Patch("announcements/:id/publish")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  publishAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communications.publishAnnouncement(tenantId, user.sub, id, user);
  }

  @Patch("announcements/:id/retract")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  retractAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communications.retractAnnouncement(tenantId, user.sub, id, user);
  }

  @Post("announcements/:id/duplicate")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  duplicateAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communications.duplicateAnnouncement(tenantId, user.sub, id, user);
  }

  @Delete("announcements/:id")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  deleteAnnouncement(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communications.deleteAnnouncement(tenantId, user.sub, id, user);
  }

  @Post("announcements/:id/read")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: MarkAnnouncementReadDto
  ) {
    return this.communications.markRead(tenantId, id, dto, user);
  }

  @Post("announcements/:id/reaction")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  setReaction(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SetAnnouncementReactionDto
  ) {
    return this.communications.setReaction(tenantId, id, dto, user);
  }

  @Get("calendar")
  @RequirePermissions(Permission.COMMUNICATIONS_DASHBOARD_VIEW)
  calendar(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.communications.calendar(tenantId, user);
  }

  @Get("reminders")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  reminders(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.communications.reminders(tenantId, user);
  }

  @Post("reminders/dispatch")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT)
  dispatchReminders(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.communications.dispatchReminders(tenantId, user.sub);
  }

  @Get("templates")
  @RequirePermissions(Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW)
  listTemplates(@TenantId() tenantId: string) {
    return this.communications.listTemplates(tenantId);
  }

  @Post("templates")
  @RequirePermissions(Permission.COMMUNICATIONS_TEMPLATES_EDIT)
  createTemplate(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.communications.createTemplate(tenantId, user.sub, dto, user);
  }
}
