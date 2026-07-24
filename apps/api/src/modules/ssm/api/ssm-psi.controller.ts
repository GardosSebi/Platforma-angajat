import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
  RegisterSsmPsiEquipmentVerificationDto,
  UpdateSsmPsiEquipmentDto
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

  @Get("equipment/notifications")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  equipmentNotifications(@TenantId() tenantId: string) {
    return this.psiService.equipmentNotifications(tenantId);
  }

  @Post("equipment/notifications/dispatch")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  dispatchNotifications(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.psiService.dispatchReminders(tenantId, user.sub);
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

  @Get("equipment/:id/verifications")
  @RequirePermissions(Permission.SSM_PSI_VIEW)
  verifications(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.psiService.listVerifications(tenantId, id);
  }

  @Patch("equipment/:id/retire")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  retireEquipment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string
  ) {
    return this.psiService.retireEquipment(tenantId, user.sub, id);
  }

  @Patch("equipment/:id")
  @RequirePermissions(Permission.SSM_PSI_EDIT)
  updateEquipment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateSsmPsiEquipmentDto
  ) {
    return this.psiService.updateEquipment(tenantId, user.sub, id, dto);
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
