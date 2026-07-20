import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { TenantGuard } from "../../auth/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { NotificationsService } from "./notifications.service";
import { WebPushService } from "./web-push.service";

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

class PushSubscribeDto {
  @IsString()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

class PushUnsubscribeDto {
  @IsString()
  endpoint!: string;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly webPush: WebPushService
  ) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Query("unreadOnly") unreadOnly?: string) {
    return this.notifications.listForUser(tenantId, user.sub, unreadOnly === "true");
  }

  @Get("unread-count")
  unreadCount(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.notifications.listForUser(tenantId, user.sub, true, 1).then((r) => ({ unreadCount: r.unreadCount }));
  }

  @Get("push/vapid-public-key")
  vapidPublicKey() {
    const result = this.webPush.getPublicKey();
    return { vapidPublicKey: result.publicKey ?? "", enabled: result.enabled };
  }

  @Post("push/subscribe")
  subscribe(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: PushSubscribeDto) {
    return this.webPush.subscribe(tenantId, user.sub, dto).then(() => ({ subscribed: true }));
  }

  @Post("push/unsubscribe")
  unsubscribe(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: PushUnsubscribeDto) {
    return this.webPush.unsubscribe(tenantId, user.sub, dto.endpoint).then(() => ({ unsubscribed: true }));
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
