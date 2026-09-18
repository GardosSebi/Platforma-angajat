import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { AuditLogService } from "../../../infrastructure/logging/audit-log.service";
import { RetentionService } from "../../../infrastructure/retention/retention.service";
import { DsarService } from "../../../infrastructure/retention/dsar.service";
import { DsarEraseDto } from "./dto/dsar-erase.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminGdprController {
  constructor(
    private readonly retention: RetentionService,
    private readonly auditLog: AuditLogService,
    private readonly dsar: DsarService
  ) {}

  @Get("gdpr/overview")
  @RequirePermissions(Permission.AUDIT_READ)
  overview(@TenantId() tenantId: string) {
    return this.retention.overview(tenantId);
  }

  @Get("gdpr/dsar/:employeeId/export.zip")
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  @Header("Content-Type", "application/zip")
  async exportDsar(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string
  ) {
    const buffer = await this.dsar.exportZip(tenantId, user.sub, employeeId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="dsar-${employeeId}.zip"`
    });
  }

  @Post("gdpr/dsar/:employeeId/erase")
  @RequirePermissions(Permission.ADMIN_USERS_EDIT)
  eraseDsar(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string,
    @Body() dto: DsarEraseDto
  ) {
    if (dto.confirmPhrase.trim().toUpperCase() !== "STERGE") {
      throw new BadRequestException('Pentru confirmare scrie exact STERGE.');
    }
    return this.dsar.erase(tenantId, user.sub, user.email, employeeId, dto.confirmEmail);
  }

  @Get("audit-logs")
  @RequirePermissions(Permission.AUDIT_READ)
  listAuditLogs(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
    @Query("module") module?: string
  ) {
    return this.auditLog.list(tenantId, { ...query, module });
  }
}
