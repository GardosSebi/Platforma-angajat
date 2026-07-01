import { Controller, Get, Header, Param, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmOverviewService } from "../application/services/ssm-overview.service";

@Controller("ssm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmOverviewController {
  constructor(private readonly overview: SsmOverviewService) {}

  @Get("overview/calendar")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  calendar(@TenantId() tenantId: string, @Query("legalEntityId") legalEntityId?: string) {
    return this.overview.unifiedCalendar(tenantId, legalEntityId);
  }

  @Get("overview/calendar.ics")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  @Header("Content-Type", "text/calendar; charset=utf-8")
  async calendarIcal(@TenantId() tenantId: string, @Query("legalEntityId") legalEntityId?: string) {
    const body = await this.overview.calendarIcal(tenantId, legalEntityId);
    return body;
  }

  @Get("overview/compliance-dashboard")
  @RequirePermissions(Permission.SSM_DASHBOARD_VIEW)
  complianceDashboard(@TenantId() tenantId: string, @Query("legalEntityId") legalEntityId?: string) {
    return this.overview.complianceDashboard(tenantId, legalEntityId);
  }

  @Get("reports/:type.pdf")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/pdf")
  async reportPdf(@TenantId() tenantId: string, @Param("type") type: string) {
    const buffer = await this.overview.reportPdf(tenantId, type);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"ssm-${type}-report.pdf\"`
    });
  }

  @Get("reports/:type.xlsx")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/vnd.ms-excel")
  async reportExcel(@TenantId() tenantId: string, @Param("type") type: string) {
    const buffer = await this.overview.reportExcel(tenantId, type);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"ssm-${type}-report.xls\"`
    });
  }

  @Get("reports/:type")
  @RequirePermissions(Permission.SSM_REPORT_VIEW)
  report(@TenantId() tenantId: string, @Param("type") type: string) {
    return this.overview.report(tenantId, type);
  }
}
