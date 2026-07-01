import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { MasterDataService } from "../master-data.service";
import { CreateLegalEntityDto } from "../dto/create-legal-entity.dto";
import { UpdateLegalEntityDto } from "../dto/update-legal-entity.dto";

@Controller("master-data/legal-entities")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class LegalEntitiesController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.masterData.listLegalEntities(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateLegalEntityDto) {
    return this.masterData.createLegalEntity(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateLegalEntityDto) {
    return this.masterData.updateLegalEntity(tenantId, id, dto);
  }
}
