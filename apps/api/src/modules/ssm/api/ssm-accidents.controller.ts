import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmAccidentsService } from "../application/services/ssm-accidents.service";
import { CloseAccidentCaseDto, CreateAccidentCaseDto, CreateAccidentTaskDto } from "./dto/ssm-accidents.dto";

@Controller("ssm/accidents")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmAccidentsController {
  constructor(private readonly accidents: SsmAccidentsService) {}

  @Get()
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.accidents.listCases(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateAccidentCaseDto) {
    return this.accidents.createCase(tenantId, user.sub, dto);
  }

  @Post("tasks")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  addTask(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateAccidentTaskDto) {
    return this.accidents.addTask(tenantId, user.sub, dto);
  }

  @Patch("tasks/:taskId/complete")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  completeTask(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("taskId") taskId: string) {
    return this.accidents.completeTask(tenantId, user.sub, taskId);
  }

  @Patch(":caseId/close")
  @RequirePermissions(Permission.SSM_ACCIDENT_APPROVE)
  closeCase(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("caseId") caseId: string,
    @Body() dto: CloseAccidentCaseDto
  ) {
    return this.accidents.closeCase(tenantId, user.sub, caseId, dto);
  }

  @Get(":caseId/report.pdf")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  @Header("Content-Type", "application/pdf")
  async reportPdf(@TenantId() tenantId: string, @Param("caseId") caseId: string) {
    const buffer = await this.accidents.researchReportPdf(tenantId, caseId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"accident-report-${caseId}.pdf\"`
    });
  }

  @Get("stats/overview")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  stats(@TenantId() tenantId: string) {
    return this.accidents.stats(tenantId);
  }
}
