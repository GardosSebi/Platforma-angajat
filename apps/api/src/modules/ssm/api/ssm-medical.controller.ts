import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission, hasAnyPermission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmMedicalService } from "../application/services/ssm-medical.service";
import {
  CreateMedicalControlDto,
  CreateMedicalControlTypeDto,
  UpdateMedicalControlDto
} from "./dto/ssm-medical.dto";

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

  @Patch("controls/:controlId")
  @UseInterceptors(FileInterceptor("aptitudeSheet"))
  @RequirePermissions(Permission.SSM_MEDICAL_EDIT, Permission.FILES_UPLOAD)
  updateControl(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("controlId") controlId: string,
    @Body() dto: UpdateMedicalControlDto,
    @UploadedFile() aptitudeSheet?: Express.Multer.File
  ) {
    return this.medicalService.updateControl(tenantId, user.sub, controlId, dto, aptitudeSheet);
  }

  @Get("controls/:controlId/aptitude-sheet")
  @RequireAnyPermissions(Permission.SSM_MEDICAL_VIEW, Permission.SSM_TRAINING_VIEW)
  async downloadAptitudeSheet(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("controlId") controlId: string
  ) {
    const canViewAllMedical = hasAnyPermission(user.roles, [Permission.SSM_MEDICAL_VIEW]);
    if (!canViewAllMedical) {
      const allowed = await this.medicalService.canEmployeeDownloadAptitudeSheet(
        tenantId,
        controlId,
        user.email
      );
      if (!allowed) {
        throw new ForbiddenException("Poți descărca doar fișa ta de aptitudini.");
      }
    }
    return this.medicalService.downloadAptitudeSheet(tenantId, controlId);
  }

  @Get("reminders")
  @RequirePermissions(Permission.SSM_MEDICAL_VIEW)
  reminders(@TenantId() tenantId: string) {
    return this.medicalService.reminders(tenantId);
  }
}
