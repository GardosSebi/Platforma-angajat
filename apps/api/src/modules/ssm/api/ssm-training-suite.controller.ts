import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmTrainingSuiteService } from "../application/services/ssm-training-suite.service";
import {
  CompleteTestDto,
  CreateTrainingPlanDto,
  CreateTrainingTypeDto,
  GenerateCollectiveSheetDto,
  MaterialCompleteDto,
  SignPlanDto,
  SignPlansBatchDto
} from "./dto/training-suite.dto";
import { assertSsmTrainingCatalogManagement } from "./ssm-viewer-scope";

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
  createType(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTrainingTypeDto
  ) {
    assertSsmTrainingCatalogManagement(user);
    return this.trainingSuite.createTrainingType(tenantId, user.sub, dto);
  }

  @Get("plans")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  listPlans(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto
  ) {
    return this.trainingSuite.listPlans(tenantId, user, query);
  }

  @Post("plans")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  createPlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTrainingPlanDto
  ) {
    assertSsmTrainingCatalogManagement(user);
    return this.trainingSuite.createTrainingPlan(tenantId, user.sub, dto);
  }

  @Patch("plans/:id/material-complete")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  completeMaterial(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: MaterialCompleteDto
  ) {
    return this.trainingSuite.markMaterialCompleted(tenantId, user.sub, id, user, dto.durationSeconds);
  }

  @Post("tests/start/:trainingPlanId")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  startTest(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("trainingPlanId") trainingPlanId: string
  ) {
    return this.trainingSuite.startTestAttempt(tenantId, user.sub, trainingPlanId, user);
  }

  @Post("tests/complete")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  completeTest(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CompleteTestDto) {
    return this.trainingSuite.completeTest(tenantId, user.sub, dto, user);
  }

  @Patch("plans/:id/sign")
  @RequireAnyPermissions(Permission.SSM_TRAINING_APPROVE, Permission.SSM_TRAINING_EDIT)
  signPlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SignPlanDto
  ) {
    return this.trainingSuite.signTrainingPlan(tenantId, user.sub, id, dto, user);
  }

  @Patch("plans/sign-batch")
  @RequirePermissions(Permission.SSM_TRAINING_APPROVE)
  signPlansBatch(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: SignPlansBatchDto) {
    return this.trainingSuite.signPlansBatch(tenantId, user.sub, dto, user);
  }

  @Get("calendar")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  calendar(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.trainingSuite.calendar(tenantId, user);
  }

  @Get("reminders")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  reminders(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.trainingSuite.remindersPreview(tenantId, user);
  }

  @Post("reminders/dispatch")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  dispatchReminders(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    assertSsmTrainingCatalogManagement(user);
    return this.trainingSuite.dispatchReminders(tenantId, user.sub);
  }

  @Get("compliance")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  compliance(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.trainingSuite.complianceReport(tenantId, user);
  }

  @Get("employees/:employeeId/digital-file")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  digitalFile(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("employeeId") employeeId: string) {
    return this.trainingSuite.digitalFile(tenantId, employeeId, user);
  }

  @Get("employees/:employeeId/digital-file.zip")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/zip")
  async exportDigitalFile(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string
  ) {
    const buffer = await this.trainingSuite.exportDigitalFileZip(tenantId, employeeId, user);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"dossier-${employeeId}.zip\"`
    });
  }

  @Get("plans/:id/individual-sheet.pdf")
  @RequirePermissions(Permission.SSM_TRAINING_VIEW)
  @Header("Content-Type", "application/pdf")
  async individualSheet(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const buffer = await this.trainingSuite.generateIndividualSheetPdf(tenantId, id, user);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"training-sheet-${id}.pdf\"`
    });
  }

  @Post("collective-sheet.pdf")
  @RequirePermissions(Permission.SSM_TRAINING_EDIT)
  @Header("Content-Type", "application/pdf")
  async collectiveSheet(@CurrentUser() user: JwtPayload, @Body() dto: GenerateCollectiveSheetDto) {
    assertSsmTrainingCatalogManagement(user);
    const buffer = await this.trainingSuite.generateCollectiveSheetPdf(dto);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"collective-sheet.pdf\"`
    });
  }
}
