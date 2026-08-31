import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmGateService } from "../application/services/ssm-gate.service";
import { BriefGateVisitDto, CreateGateVisitDto, SignGateVisitDto } from "./dto/ssm-gate.dto";

@Controller("ssm/gate")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmGateController {
  constructor(private readonly gate: SsmGateService) {}

  @Get("admission-blocks")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  admissionBlocks(@TenantId() tenantId: string, @Query("worksiteId") worksiteId?: string) {
    return this.gate.listAdmissionBlocks(tenantId, worksiteId);
  }

  @Get("visits")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  listVisits(@TenantId() tenantId: string, @Query("worksiteId") worksiteId?: string) {
    return this.gate.listVisits(tenantId, worksiteId);
  }

  @Get("visits/:visitId")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  getVisit(@TenantId() tenantId: string, @Param("visitId") visitId: string) {
    return this.gate.getVisit(tenantId, visitId);
  }

  @Post("visits")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  createVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateGateVisitDto
  ) {
    return this.gate.createVisit(tenantId, user.sub, dto);
  }

  @Patch("visits/:visitId/briefing")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  briefVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("visitId") visitId: string,
    @Body() dto: BriefGateVisitDto
  ) {
    return this.gate.briefVisit(tenantId, user.sub, visitId, dto);
  }

  @Patch("visits/:visitId/sign")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  signVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("visitId") visitId: string,
    @Body() dto: SignGateVisitDto
  ) {
    return this.gate.signVisit(tenantId, user.sub, visitId, dto);
  }

  @Get("visits/:visitId/anexa-12.pdf")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/pdf")
  async anexa12Pdf(@TenantId() tenantId: string, @Param("visitId") visitId: string) {
    const buffer = await this.gate.anexa12Pdf(tenantId, visitId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="fisa-colectiva-anexa-12-${visitId}.pdf"`
    });
  }
}
