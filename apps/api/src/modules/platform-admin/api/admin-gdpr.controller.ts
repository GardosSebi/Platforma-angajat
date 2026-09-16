import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { AuditLogService } from "../../../infrastructure/logging/audit-log.service";
import { RetentionService } from "../../../infrastructure/retention/retention.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminGdprController {
  constructor(
    private readonly retention: RetentionService,
    private readonly auditLog: AuditLogService
  ) {}

  @Get("gdpr/overview")
  @RequirePermissions(Permission.AUDIT_READ)
  overview(@TenantId() tenantId: string) {
    return this.retention.overview(tenantId);
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
