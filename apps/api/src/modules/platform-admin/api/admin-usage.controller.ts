import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PlatformAdminService } from "../platform-admin.service";

@Controller("admin/usage")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminUsageController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get("summary")
  @RequirePermissions(Permission.USAGE_STATS_VIEW)
  summary(@TenantId() tenantId: string, @Query("from") fromRaw?: string, @Query("to") toRaw?: string) {
    const to = toRaw ? new Date(toRaw) : new Date();
    if (Number.isNaN(to.getTime())) {
      throw new BadRequestException("Invalid `to` date");
    }
    const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime())) {
      throw new BadRequestException("Invalid `from` date");
    }
    if (from > to) {
      throw new BadRequestException("`from` must be before or equal to `to`");
    }
    return this.platformAdmin.getUsageSummary(tenantId, from, to);
  }
}
