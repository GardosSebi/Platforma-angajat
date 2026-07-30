import { Controller, Get, Header, Param, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmOverviewService, type SsmOverviewQuery } from "../application/services/ssm-overview.service";

@Controller("ssm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmOverviewController {
  constructor(private readonly overview: SsmOverviewService) {}

  private overviewQuery(
    legalEntityId?: string,
    worksiteId?: string,
    departmentId?: string,
    employeeId?: string,
    source?: string,
    from?: string,
    to?: string,
    docIssue?: string
  ): SsmOverviewQuery {
    return { legalEntityId, worksiteId, departmentId, employeeId, source, from, to, docIssue };
  }

  @Get("overview/calendar")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  calendar(
    @TenantId() tenantId: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.overview.unifiedCalendar(
      tenantId,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, source, from, to)
    );
  }

  @Get("overview/calendar.ics")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  @Header("Content-Type", "text/calendar; charset=utf-8")
  async calendarIcal(
    @TenantId() tenantId: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.overview.calendarIcal(
      tenantId,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, source, from, to)
    );
  }

  @Get("overview/calendar.pdf")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  @Header("Content-Type", "application/pdf")
  async calendarPdf(
    @TenantId() tenantId: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const buffer = await this.overview.calendarPdf(
      tenantId,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, source, from, to)
    );
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="ssm-calendar.pdf"`
    });
  }

  @Get("overview/compliance-dashboard")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  complianceDashboard(
    @TenantId() tenantId: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string
  ) {
    return this.overview.complianceDashboard(
      tenantId,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId)
    );
  }

  @Get("reports/:type.pdf")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/pdf")
  async reportPdf(
    @TenantId() tenantId: string,
    @Param("type") type: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("docIssue") docIssue?: string
  ) {
    const buffer = await this.overview.reportPdf(
      tenantId,
      type,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, undefined, from, to, docIssue)
    );
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"ssm-${type}-report.pdf\"`
    });
  }

  @Get("reports/:type.xlsx")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  async reportExcel(
    @TenantId() tenantId: string,
    @Param("type") type: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("docIssue") docIssue?: string
  ) {
    const buffer = await this.overview.reportExcel(
      tenantId,
      type,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, undefined, from, to, docIssue)
    );
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"ssm-${type}-report.xlsx\"`
    });
  }

  @Get("reports/:type")
  @RequirePermissions(Permission.SSM_REPORT_VIEW)
  report(
    @TenantId() tenantId: string,
    @Param("type") type: string,
    @Query("legalEntityId") legalEntityId?: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("docIssue") docIssue?: string
  ) {
    return this.overview.report(
      tenantId,
      type,
      this.overviewQuery(legalEntityId, worksiteId, departmentId, employeeId, undefined, from, to, docIssue)
    );
  }
}
