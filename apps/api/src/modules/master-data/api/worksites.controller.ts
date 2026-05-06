import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateWorksiteDto } from "../dto/create-worksite.dto";

@Controller("master-data/worksites")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WorksitesController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string) {
    return this.masterData.listWorksites(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateWorksiteDto) {
    return this.masterData.createWorksite(tenantId, dto);
  }
}
