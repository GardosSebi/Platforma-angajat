import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SsmAccidentAttachmentKind } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmAccidentsService } from "../application/services/ssm-accidents.service";
import {
  CloseAccidentCaseDto,
  CreateAccidentCaseDto,
  CreateAccidentCorrectiveMeasureDto,
  CreateAccidentTaskDto
} from "./dto/ssm-accidents.dto";

class AccidentStatsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

class AccidentAttachmentBodyDto {
  @IsEnum(SsmAccidentAttachmentKind)
  kind!: SsmAccidentAttachmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

@Controller("ssm/accidents")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmAccidentsController {
  constructor(private readonly accidents: SsmAccidentsService) {}

  @Get()
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.accidents.listCases(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateAccidentCaseDto) {
    return this.accidents.createCase(tenantId, user.sub, dto);
  }

  @Post("tasks")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  addTask(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateAccidentTaskDto) {
    return this.accidents.addTask(tenantId, user.sub, dto);
  }

  @Patch("tasks/:taskId/complete")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  completeTask(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("taskId") taskId: string) {
    return this.accidents.completeTask(tenantId, user.sub, taskId);
  }

  @Post("measures")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  addMeasure(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateAccidentCorrectiveMeasureDto
  ) {
    return this.accidents.addCorrectiveMeasure(tenantId, user.sub, dto);
  }

  @Patch("measures/:measureId/complete")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  completeMeasure(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("measureId") measureId: string
  ) {
    return this.accidents.completeCorrectiveMeasure(tenantId, user.sub, measureId);
  }

  @Get("stats/overview")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  stats(@TenantId() tenantId: string, @Query() query: AccidentStatsQueryDto) {
    return this.accidents.stats(tenantId, { from: query.from, to: query.to });
  }

  @Get(":caseId/attachments")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  listAttachments(@TenantId() tenantId: string, @Param("caseId") caseId: string) {
    return this.accidents.listAttachments(tenantId, caseId);
  }

  @Post(":caseId/attachments")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT, Permission.FILES_UPLOAD)
  uploadAttachment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("caseId") caseId: string,
    @Body() dto: AccidentAttachmentBodyDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("File is required.");
    }
    return this.accidents.uploadAttachment(tenantId, user.sub, caseId, dto.kind, file, dto.notes);
  }

  @Get(":caseId/attachments/:attachmentId")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  downloadAttachment(
    @TenantId() tenantId: string,
    @Param("caseId") caseId: string,
    @Param("attachmentId") attachmentId: string
  ) {
    return this.accidents.downloadAttachment(tenantId, caseId, attachmentId);
  }

  @Delete(":caseId/attachments/:attachmentId")
  @RequirePermissions(Permission.SSM_ACCIDENT_EDIT)
  deleteAttachment(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("caseId") caseId: string,
    @Param("attachmentId") attachmentId: string
  ) {
    return this.accidents.deleteAttachment(tenantId, user.sub, caseId, attachmentId);
  }

  @Patch(":caseId/close")
  @RequirePermissions(Permission.SSM_ACCIDENT_APPROVE)
  closeCase(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("caseId") caseId: string,
    @Body() dto: CloseAccidentCaseDto
  ) {
    return this.accidents.closeCase(tenantId, user.sub, caseId, dto);
  }

  @Get(":caseId/report.pdf")
  @RequirePermissions(Permission.SSM_ACCIDENT_VIEW)
  @Header("Content-Type", "application/pdf")
  async reportPdf(@TenantId() tenantId: string, @Param("caseId") caseId: string) {
    const buffer = await this.accidents.researchReportPdf(tenantId, caseId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename=\"accident-report-${caseId}.pdf\"`
    });
  }
}
