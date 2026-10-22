import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmExposureSheetService } from "../application/services/ssm-exposure-sheet.service";
import {
  IssueMissingSsmExposureSheetsDto,
  IssueSsmExposureSheetDto,
  ListSsmExposureSheetsDto,
  SignSsmExposureAssessorDto,
  SignSsmExposureEmployeeDto,
  SsmExposureCoverageQueryDto
} from "./dto/ssm-exposure.dto";

@Controller("ssm/exposure-sheets")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmExposureController {
  constructor(private readonly exposure: SsmExposureSheetService) {}

  @Get()
  @RequireAnyPermissions(Permission.SSM_RISK_VIEW, Permission.SSM_TRAINING_VIEW)
  list(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Query() query: ListSsmExposureSheetsDto) {
    return this.exposure.list(tenantId, user, query);
  }

  @Get("coverage")
  @RequirePermissions(Permission.SSM_RISK_VIEW)
  coverage(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Query() query: SsmExposureCoverageQueryDto) {
    return this.exposure.coverage(tenantId, user, query);
  }

  @Post("issue")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  issue(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: IssueSsmExposureSheetDto) {
    return this.exposure.issueManual(tenantId, user.sub, dto.employeeId);
  }

  @Post("issue-missing")
  @RequirePermissions(Permission.SSM_RISK_EDIT)
  issueMissing(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: IssueMissingSsmExposureSheetsDto
  ) {
    return this.exposure.issueMissing(tenantId, user, dto);
  }

  @Patch(":id/sign-employee")
  @RequireAnyPermissions(Permission.SSM_TRAINING_EDIT, Permission.SSM_RISK_EDIT)
  signEmployee(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SignSsmExposureEmployeeDto
  ) {
    return this.exposure.signEmployee(tenantId, user, id, dto);
  }

  @Patch(":id/sign-assessor")
  @RequirePermissions(Permission.SSM_RISK_APPROVE)
  signAssessor(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SignSsmExposureAssessorDto
  ) {
    return this.exposure.signAssessor(tenantId, user, id, dto);
  }

  @Get(":id/pdf")
  @RequireAnyPermissions(Permission.SSM_RISK_VIEW, Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/pdf")
  async pdf(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const { buffer, fileName } = await this.exposure.pdf(tenantId, user, id);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${fileName}"` });
  }
}
