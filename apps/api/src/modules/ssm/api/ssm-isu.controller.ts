import { Controller, Get, Header, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmIsuControlService } from "../application/services/ssm-isu-control.service";

@Controller("ssm/isu")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmIsuController {
  constructor(private readonly isu: SsmIsuControlService) {}

  @Get("readiness")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  readiness(@TenantId() tenantId: string, @Query("worksiteId") worksiteId?: string) {
    return this.isu.readiness(tenantId, worksiteId || undefined);
  }

  @Get("control-package.zip")
  @RequirePermissions(Permission.SSM_PSI_VIEW, Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/zip")
  async controlPackage(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query("worksiteId") worksiteId?: string
  ) {
    const { buffer, fileName } = await this.isu.exportPackage(tenantId, user, worksiteId || undefined);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${fileName}"` });
  }
}
