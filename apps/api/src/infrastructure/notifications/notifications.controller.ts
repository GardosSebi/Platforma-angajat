import { Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { TenantGuard } from "../../auth/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Query("unreadOnly") unreadOnly?: string) {
    return this.notifications.listForUser(tenantId, user.sub, unreadOnly === "true");
  }

  @Get("unread-count")
  unreadCount(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.notifications.listForUser(tenantId, user.sub, true, 1).then((r) => ({ unreadCount: r.unreadCount }));
  }

  @Patch(":id/read")
  markRead(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.notifications.markRead(tenantId, user.sub, id);
  }

  @Post("read-all")
  markAllRead(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.notifications.markAllRead(tenantId, user.sub);
  }
}
