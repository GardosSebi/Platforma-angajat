import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmPsiService } from "../application/services/ssm-psi.service";
import {
  CreateSsmPsiEquipmentDto,
  CreateSsmPsiResponsibleDto,
  CreateSsmPsiTrainingRecordDto,
  RegisterSsmPsiEquipmentVerificationDto
} from "./dto/ssm-psi.dto";

@Controller("ssm/psi")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmPsiController {
  constructor(private readonly psiService: SsmPsiService) {}

  @Get("documentation")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  documentation(@TenantId() tenantId: string) {
    return this.psiService.documentationByWorksite(tenantId);
  }

  @Get("equipment")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  equipment(@TenantId() tenantId: string) {
    return this.psiService.listEquipment(tenantId);
  }

  @Post("equipment")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  createEquipment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmPsiEquipmentDto
  ) {
    return this.psiService.createEquipment(tenantId, user.sub, dto);
  }

  @Post("equipment/verifications")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  registerVerification(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: RegisterSsmPsiEquipmentVerificationDto
  ) {
    return this.psiService.registerVerification(tenantId, user.sub, dto);
  }

  @Get("equipment/notifications")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  equipmentNotifications(@TenantId() tenantId: string) {
    return this.psiService.equipmentNotifications(tenantId);
  }

  @Get("trainings")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  trainings(@TenantId() tenantId: string) {
    return this.psiService.listTrainingRecords(tenantId);
  }

  @Post("trainings")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  createTraining(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmPsiTrainingRecordDto
  ) {
    return this.psiService.createTrainingRecord(tenantId, user.sub, dto);
  }

  @Get("responsibles")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  responsibles(@TenantId() tenantId: string) {
    return this.psiService.listResponsibles(tenantId);
  }

  @Post("responsibles")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  createResponsible(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmPsiResponsibleDto
  ) {
    return this.psiService.createResponsible(tenantId, user.sub, dto);
  }
}
