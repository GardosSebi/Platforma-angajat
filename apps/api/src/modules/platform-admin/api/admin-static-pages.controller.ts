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
import { PlatformAdminService } from "../platform-admin.service";
import { CreateStaticPageDto, UpdateStaticPageDto } from "./dto/create-static-page.dto";

@Controller("admin/static-pages")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminStaticPagesController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  @RequirePermissions(Permission.STATIC_PAGES_MANAGE)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.platformAdmin.listStaticPagesAdmin(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.STATIC_PAGES_MANAGE)
  create(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateStaticPageDto) {
    return this.platformAdmin.createStaticPage(tenantId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.STATIC_PAGES_MANAGE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateStaticPageDto) {
    return this.platformAdmin.updateStaticPage(tenantId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permission.STATIC_PAGES_MANAGE)
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.platformAdmin.deleteStaticPage(tenantId, id);
  }
}
