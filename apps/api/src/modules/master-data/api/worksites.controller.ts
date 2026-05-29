import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateWorksiteDto } from "../dto/create-worksite.dto";
import { UpdateWorksiteDto } from "../dto/update-worksite.dto";

@Controller("master-data/worksites")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WorksitesController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.masterData.listWorksites(tenantId, query, user);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateWorksiteDto) {
    return this.masterData.createWorksite(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateWorksiteDto) {
    return this.masterData.updateWorksite(tenantId, id, dto);
  }
}
