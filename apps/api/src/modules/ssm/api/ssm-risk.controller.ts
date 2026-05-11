import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmRiskService } from "../application/services/ssm-risk.service";
import {
  AddSsmRiskAssessmentVersionDto,
  CreateSsmRiskAssessmentDto,
  ListSsmRiskAssessmentsDto
} from "./dto/ssm-risk.dto";

@Controller("ssm/risk-assessments")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmRiskController {
  constructor(private readonly riskService: SsmRiskService) {}

  @Get()
  @RequirePermissions(Permission.SSM_RISK_VIEW)
  list(@TenantId() tenantId: string, @Query() query: ListSsmRiskAssessmentsDto) {
    return this.riskService.listAssessments(tenantId, query);
  }

  @Get(":id/history")
  @RequirePermissions(Permission.SSM_RISK_VIEW)
  history(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.riskService.history(tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmRiskAssessmentDto
  ) {
    return this.riskService.createAssessment(tenantId, user.sub, dto);
  }

  @Post(":id/versions")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  addVersion(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: AddSsmRiskAssessmentVersionDto
  ) {
    return this.riskService.addVersion(tenantId, user.sub, id, dto);
  }

  @Patch(":id/archive")
  @RequirePermissions(Permission.SSM_RISK_APPROVE)
  archive(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.riskService.archiveAssessment(tenantId, user.sub, id);
  }
}
