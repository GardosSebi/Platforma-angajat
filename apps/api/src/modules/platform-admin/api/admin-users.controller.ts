import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PlatformAdminService } from "../platform-admin.service";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import { PatchTenantUserDto } from "./dto/patch-tenant-user.dto";

@Controller("admin/users")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  @RequirePermissions(Permission.ADMIN_USERS_VIEW)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.platformAdmin.listTenantUsers(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() actor: JwtPayload, @Body() dto: CreateTenantUserDto) {
    return this.platformAdmin.createTenantUser(tenantId, actor.sub, actor.roles ?? [], dto);
  }

  @Get(":userId/scoped-roles")
  @RequirePermissions(Permission.ADMIN_USERS_VIEW)
  listScoped(@TenantId() tenantId: string, @Param("userId") userId: string) {
    return this.platformAdmin.listScopedRoles(tenantId, userId);
  }

  @Patch(":userId")
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  patch(
    @TenantId() tenantId: string,
    @CurrentUser() actor: JwtPayload,
    @Param("userId") userId: string,
    @Body() dto: PatchTenantUserDto
  ) {
    return this.platformAdmin.patchTenantUser(tenantId, actor.roles ?? [], userId, dto);
  }
}
