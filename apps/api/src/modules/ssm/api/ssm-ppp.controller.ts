import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmPppService } from "../application/services/ssm-ppp.service";
import {
  CreateSsmEvacuationDrillDto,
  CreateSsmPreventionMeasureDto,
  CreateSsmPreventionPlanDto,
  ListSsmPreventionPlansDto,
  UpdateSsmPreventionMeasureDto
} from "./dto/ssm-ppp.dto";

@Controller("ssm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmPppController {
  constructor(private readonly pppService: SsmPppService) {}

  @Get("prevention-plans")
  @RequirePermissions(Permission.SSM_RISK_VIEW)
  listPlans(@TenantId() tenantId: string, @Query() query: ListSsmPreventionPlansDto) {
    return this.pppService.listPlans(tenantId, query);
  }

  @Post("prevention-plans")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  createPlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmPreventionPlanDto
  ) {
    return this.pppService.createPlan(tenantId, user.sub, dto);
  }

  @Patch("prevention-plans/:id/archive")
  @RequirePermissions(Permission.SSM_RISK_APPROVE)
  archivePlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string
  ) {
    return this.pppService.archivePlan(tenantId, user.sub, id);
  }

  @Post("prevention-measures")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  createMeasure(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmPreventionMeasureDto
  ) {
    return this.pppService.createMeasure(tenantId, user.sub, dto);
  }

  @Patch("prevention-measures/:id")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  updateMeasure(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateSsmPreventionMeasureDto
  ) {
    return this.pppService.updateMeasure(tenantId, user.sub, id, dto);
  }

  @Get("evacuation-drills")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  listEvacuationDrills(@TenantId() tenantId: string) {
    return this.pppService.listEvacuationDrills(tenantId);
  }

  @Post("evacuation-drills")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  createEvacuationDrill(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmEvacuationDrillDto
  ) {
    return this.pppService.createEvacuationDrill(tenantId, user.sub, dto);
  }
}
