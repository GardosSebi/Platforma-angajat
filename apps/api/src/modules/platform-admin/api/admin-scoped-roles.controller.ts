import { Body, Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { PlatformAdminService } from "../platform-admin.service";
import { CreateScopedRoleDto } from "./dto/create-scoped-role.dto";

@Controller("admin/scoped-roles")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminScopedRolesController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Post()
  @RequirePermissions(Permission.ADMIN_ROLE_SCOPE_MANAGE)
  create(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateScopedRoleDto) {
    return this.platformAdmin.createScopedRole(tenantId, user.sub, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permission.ADMIN_ROLE_SCOPE_MANAGE)
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.platformAdmin.deleteScopedRole(tenantId, id);
  }
}
