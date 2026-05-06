import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { MasterDataService } from "../master-data.service";
import { ImportEmployeesDto } from "../dto/import-employees.dto";

@Controller("master-data/import")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MasterDataImportController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post("employees")
  @RequirePermissions(Permission.MASTER_DATA_IMPORT)
  importEmployees(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportEmployeesDto
  ) {
    return this.masterData.importEmployeesFromCsv(tenantId, dto.csv, user.sub);
  }
}
