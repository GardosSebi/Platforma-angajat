import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmTrainingSuiteService } from "../application/services/ssm-training-suite.service";
import { CompleteTestDto, CreateTrainingPlanDto, CreateTrainingTypeDto, SignPlanDto } from "./dto/training-suite.dto";

@Controller("ssm/training-suite")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmTrainingSuiteController {
  constructor(private readonly trainingSuite: SsmTrainingSuiteService) {}

  @Get("types")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  listTypes(@TenantId() tenantId: string) {
    return this.trainingSuite.listTrainingTypes(tenantId);
  }

  @Post("types")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  createType(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateTrainingTypeDto) {
    return this.trainingSuite.createTrainingType(tenantId, user.sub, dto);
  }

  @Get("plans")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  listPlans(@TenantId() tenantId: string) {
    return this.trainingSuite.listPlans(tenantId);
  }

  @Post("plans")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  createPlan(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateTrainingPlanDto) {
    return this.trainingSuite.createTrainingPlan(tenantId, user.sub, dto);
  }

  @Patch("plans/:id/material-complete")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  completeMaterial(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.trainingSuite.markMaterialCompleted(tenantId, user.sub, id);
  }

  @Post("tests/start/:trainingPlanId")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  startTest(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("trainingPlanId") trainingPlanId: string
  ) {
    return this.trainingSuite.startTestAttempt(tenantId, user.sub, trainingPlanId);
  }

  @Post("tests/complete")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  completeTest(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CompleteTestDto) {
    return this.trainingSuite.completeTest(tenantId, user.sub, dto);
  }

  @Patch("plans/:id/sign")
  @RequirePermissions(Permission.SSM_TRAINING_APPROVE)
  signPlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: SignPlanDto
  ) {
    return this.trainingSuite.signTrainingPlan(tenantId, user.sub, id, dto);
  }

  @Get("calendar")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  calendar(@TenantId() tenantId: string) {
    return this.trainingSuite.calendar(tenantId);
  }

  @Get("reminders")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  reminders(@TenantId() tenantId: string) {
    return this.trainingSuite.remindersPreview(tenantId);
  }

  @Get("compliance")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  compliance(@TenantId() tenantId: string) {
    return this.trainingSuite.complianceReport(tenantId);
  }

  @Get("employees/:employeeId/digital-file")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  digitalFile(@TenantId() tenantId: string, @Param("employeeId") employeeId: string) {
    return this.trainingSuite.digitalFile(tenantId, employeeId);
  }

  @Get("employees/:employeeId/digital-file.zip")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/zip")
  async exportDigitalFile(@TenantId() tenantId: string, @Param("employeeId") employeeId: string) {
    const buffer = await this.trainingSuite.exportDigitalFileZip(tenantId, employeeId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"dossier-${employeeId}.zip\"`
    });
  }

  @Get("plans/:id/individual-sheet.pdf")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/pdf")
  async individualSheet(@TenantId() tenantId: string, @Param("id") id: string) {
    const buffer = await this.trainingSuite.generateIndividualSheetPdf(tenantId, id);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"training-sheet-${id}.pdf\"`
    });
  }
}
