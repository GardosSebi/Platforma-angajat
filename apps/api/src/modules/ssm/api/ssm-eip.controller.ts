import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmEipService } from "../application/services/ssm-eip.service";
import { CreateEipMovementDto, CreateEipNormDto, CreateEipTypeDto } from "./dto/ssm-eip.dto";

@Controller("ssm/eip")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmEipController {
  constructor(private readonly eipService: SsmEipService) {}

  @Get("types")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  listTypes(@TenantId() tenantId: string) {
    return this.eipService.listTypes(tenantId);
  }

  @Post("types")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  createType(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipTypeDto) {
    return this.eipService.createType(tenantId, user.sub, dto);
  }

  @Get("norms")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  listNorms(@TenantId() tenantId: string) {
    return this.eipService.listNorms(tenantId);
  }

  @Post("norms")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  upsertNorm(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipNormDto) {
    return this.eipService.upsertNorm(tenantId, user.sub, dto);
  }

  @Post("movements")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  movement(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipMovementDto) {
    return this.eipService.registerMovement(tenantId, user.sub, dto);
  }

  @Get("register")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  register(@TenantId() tenantId: string) {
    return this.eipService.movementRegister(tenantId);
  }

  @Get("notifications")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  notifications(@TenantId() tenantId: string) {
    return this.eipService.dueNotifications(tenantId);
  }

  @Get("reports/stock-gap")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  stockGap(@TenantId() tenantId: string) {
    return this.eipService.stockGapReport(tenantId);
  }
}
