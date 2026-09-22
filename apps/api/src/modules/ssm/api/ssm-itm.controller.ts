import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { ItmAccessService } from "../application/services/itm-access.service";
import { SsmItmPortalService } from "../application/services/ssm-itm-portal.service";
import { CloseItmInspectionVisitDto, CreateItmInspectionVisitDto } from "./dto/itm-inspection.dto";

@Controller("ssm/itm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmItmController {
  constructor(
    private readonly itmAccess: ItmAccessService,
    private readonly portal: SsmItmPortalService
  ) {}

  @Get("access-logs")
  @RequireAnyPermissions(Permission.SSM_REPORT_VIEW, Permission.AUDIT_READ)
  accessLogs(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.portal.listAccessLogsForViewer(tenantId, user);
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

  @Get("worksites")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  worksites(@TenantId() tenantId: string) {
    return this.portal.listWorksites(tenantId);
  }

  @Get("employees")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  employees(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("worksiteId") worksiteId?: string
  ) {
    return this.portal.listEmployees(tenantId, user, q, worksiteId);
  }

  @Get("employees/:employeeId/dossier")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  employeeDossier(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string
  ) {
    return this.portal.employeeDossier(tenantId, user, employeeId);
  }

  @Get("employees/:employeeId/dossier.zip")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/zip")
  async employeeDossierZip(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string
  ) {
    const buffer = await this.portal.exportEmployeeDossierZip(tenantId, user, employeeId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="dosar-itm-${employeeId}.zip"`
    });
  }

  @Get("control")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  control(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query("worksiteId") worksiteId?: string
  ) {
    return this.portal.controlFolders(tenantId, user, worksiteId);
  }

  @Get("control-package.zip")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  @Header("Content-Type", "application/zip")
  async controlPackage(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query("worksiteId") worksiteId?: string
  ) {
    const buffer = await this.portal.exportControlPackage(tenantId, user, worksiteId);
    return new StreamableFile(buffer, {
      disposition: 'attachment; filename="pachet-control-itm.zip"'
    });
  }

  @Get("visits")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  visits(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query("worksiteId") worksiteId?: string
  ) {
    return this.portal.listVisits(tenantId, user, worksiteId);
  }

  @Post("visits")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  startVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateItmInspectionVisitDto
  ) {
    return this.portal.startVisit(tenantId, user, dto);
  }

  @Patch("visits/:visitId/close")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  closeVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("visitId") visitId: string,
    @Body() dto: CloseItmInspectionVisitDto
  ) {
    return this.portal.closeVisit(tenantId, user, visitId, dto);
  }
}
