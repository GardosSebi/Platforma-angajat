import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmManagerTeamService } from "../application/services/ssm-manager-team.service";

@Controller("ssm/manager")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmManagerController {
  constructor(private readonly team: SsmManagerTeamService) {}

  @Get("team")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  teamOverview(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.team.getTeamOverview(tenantId, user);
  }
}
