import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import {
  CommunicationChatService,
  CreateExternalContactDto,
  PostChatMessageDto
} from "../application/services/communication-chat.service";

@Controller("chatbot")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CommunicationChatController {
  constructor(private readonly chat: CommunicationChatService) {}

  @Get("external-contacts")
  @RequireAnyPermissions(
    Permission.COMMUNICATIONS_EXTERNAL_MANAGE,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.COMMUNICATIONS_CHAT_VIEW
  )
  listContacts(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.chat.listContacts(tenantId, user);
  }

  @Post("external-contacts")
  @RequireAnyPermissions(Permission.COMMUNICATIONS_EXTERNAL_MANAGE, Permission.ADMIN_USERS_EDIT)
  createContact(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExternalContactDto
  ) {
    return this.chat.createContact(tenantId, user.sub, dto, user);
  }

  @Delete("external-contacts/:id")
  @RequireAnyPermissions(Permission.COMMUNICATIONS_EXTERNAL_MANAGE, Permission.ADMIN_USERS_EDIT)
  removeContact(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.chat.removeContact(tenantId, id, user);
  }

  @Get("chat/channels")
  @RequireAnyPermissions(
    Permission.COMMUNICATIONS_CHAT_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.COMMUNICATIONS_EXTERNAL_MANAGE
  )
  listChannels(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.chat.listChannels(tenantId, user);
  }

  @Get("chat/channels/:channelId/messages")
  @RequireAnyPermissions(
    Permission.COMMUNICATIONS_CHAT_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.COMMUNICATIONS_EXTERNAL_MANAGE
  )
  listMessages(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("channelId") channelId: string
  ) {
    return this.chat.listMessages(tenantId, channelId, user);
  }

  @Post("chat/channels/:channelId/messages")
  @RequireAnyPermissions(
    Permission.COMMUNICATIONS_CHAT_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.COMMUNICATIONS_EXTERNAL_MANAGE
  )
  postMessage(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("channelId") channelId: string,
    @Body() dto: PostChatMessageDto
  ) {
    return this.chat.postMessage(tenantId, channelId, dto, user);
  }
}
