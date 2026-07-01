import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateSsmResponsibleDto } from "../dto/create-ssm-responsible.dto";
import { UpdateSsmResponsibleDto } from "../dto/update-ssm-responsible.dto";

@Controller("master-data/ssm-responsibles")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmResponsiblesController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.masterData.listSsmResponsibles(tenantId, query);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateSsmResponsibleDto) {
    return this.masterData.createSsmResponsible(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateSsmResponsibleDto) {
    return this.masterData.updateSsmResponsible(tenantId, id, dto);
  }
}
