import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PlatformAdminService } from "../platform-admin.service";
import { UpsertTenantSsoConfigDto } from "./dto/upsert-sso-config.dto";

@Controller("admin/sso-config")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminSsoController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  @RequirePermissions(Permission.ADMIN_USERS_VIEW)
  get(@TenantId() tenantId: string) {
    return this.platformAdmin.getSsoConfig(tenantId);
  }

  @Put()
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  upsert(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertTenantSsoConfigDto
  ) {
    return this.platformAdmin.upsertSsoConfig(tenantId, user.sub, dto);
  }
}
