import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { ItmAccessService } from "../application/services/itm-access.service";

@Controller("ssm/itm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmItmController {
  constructor(private readonly itmAccess: ItmAccessService) {}

  @Get("access-logs")
  @RequirePermissions(Permission.SSM_REPORT_VIEW)
  accessLogs(@TenantId() tenantId: string) {
    return this.itmAccess.listAccessLogs(tenantId);
  }

  @Post("grant-access")
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  grantAccess(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { userId: string; expiresAt: string }
  ) {
    return this.itmAccess.grantTemporaryAccess(tenantId, body.userId, new Date(body.expiresAt), user.sub);
  }
}
