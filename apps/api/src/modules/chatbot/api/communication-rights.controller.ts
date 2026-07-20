import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CommunicationPublishScope } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CommunicationRightsService } from "../application/services/communication-rights.service";

class CreatePublishRightDto {
  @IsString()
  userId!: string;

  @IsEnum(CommunicationPublishScope)
  scopeType!: CommunicationPublishScope;

  @IsOptional()
  @IsString()
  legalEntityId?: string | null;

  @IsOptional()
  @IsString()
  employeeGroupId?: string | null;

  @IsOptional()
  @IsString()
  worksiteId?: string | null;

  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageTemplates?: boolean;
}

@Controller("chatbot/publish-rights")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CommunicationRightsController {
  constructor(private readonly rights: CommunicationRightsService) {}

  @Get()
  @RequirePermissions(Permission.ADMIN_USERS_VIEW)
  list(@TenantId() tenantId: string) {
    return this.rights.list(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreatePublishRightDto) {
    return this.rights.create(tenantId, user.sub, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.rights.remove(tenantId, id);
  }
}
