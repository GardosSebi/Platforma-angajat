import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { SsmReportCadence, SsmReportDeliveryFormat } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { SsmScheduledReportsService } from "../application/services/ssm-scheduled-reports.service";

class CreateScheduledReportDto {
  @IsString()
  reportType!: string;

  @IsEnum(SsmReportCadence)
  cadence!: SsmReportCadence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number | null;

  @IsArray()
  @IsString({ each: true })
  recipients!: string[];

  @IsOptional()
  @IsEnum(SsmReportDeliveryFormat)
  format?: SsmReportDeliveryFormat;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateScheduledReportDto {
  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsEnum(SsmReportCadence)
  cadence?: SsmReportCadence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @IsEnum(SsmReportDeliveryFormat)
  format?: SsmReportDeliveryFormat;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller("ssm/scheduled-reports")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmScheduledReportsController {
  constructor(private readonly scheduled: SsmScheduledReportsService) {}

  @Get()
  @RequirePermissions(Permission.SSM_REPORT_VIEW)
  list(@TenantId() tenantId: string) {
    return this.scheduled.list(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  create(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateScheduledReportDto) {
    return this.scheduled.create(tenantId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateScheduledReportDto) {
    return this.scheduled.update(tenantId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permission.SSM_REPORT_EXPORT)
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.scheduled.remove(tenantId, id);
  }
}
