import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmMedicalService } from "../application/services/ssm-medical.service";
import { CreateMedicalControlDto, CreateMedicalControlTypeDto } from "./dto/ssm-medical.dto";

@Controller("ssm/medical")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmMedicalController {
  constructor(private readonly medicalService: SsmMedicalService) {}

  @Get("control-types")
  @RequirePermissions(Permission.SSM_MEDICAL_VIEW)
  listControlTypes(@TenantId() tenantId: string) {
    return this.medicalService.listControlTypes(tenantId);
  }

  @Post("control-types")
  @RequirePermissions(Permission.SSM_MEDICAL_EDIT)
  createControlType(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateMedicalControlTypeDto) {
    return this.medicalService.createControlType(tenantId, user.sub, dto);
  }

  @Get("controls")
  @RequirePermissions(Permission.SSM_MEDICAL_VIEW)
  listControls(@TenantId() tenantId: string) {
    return this.medicalService.listControls(tenantId);
  }

  @Post("controls")
  @UseInterceptors(FileInterceptor("aptitudeSheet"))
  @RequirePermissions(Permission.SSM_MEDICAL_EDIT, Permission.FILES_UPLOAD)
  createControl(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateMedicalControlDto,
    @UploadedFile() aptitudeSheet?: Express.Multer.File
  ) {
    return this.medicalService.createControl(tenantId, user.sub, dto, aptitudeSheet);
  }

  @Get("reminders")
  @RequirePermissions(Permission.SSM_MEDICAL_VIEW)
  reminders(@TenantId() tenantId: string) {
    return this.medicalService.reminders(tenantId);
  }
}
