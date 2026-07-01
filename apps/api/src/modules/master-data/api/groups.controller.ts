import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateEmployeeGroupDto } from "../dto/create-group.dto";
import { UpdateEmployeeGroupDto } from "../dto/update-group.dto";

@Controller("master-data/groups")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GroupsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    return this.masterData.listGroups(tenantId, query);
  }

  @Get(":id")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  getOne(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.masterData.getGroup(tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateEmployeeGroupDto) {
    return this.masterData.createGroup(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateEmployeeGroupDto) {
    return this.masterData.updateGroup(tenantId, id, dto);
  }

  @Post(":groupId/members/:employeeId")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  addMember(
    @TenantId() tenantId: string,
    @Param("groupId") groupId: string,
    @Param("employeeId") employeeId: string
  ) {
    return this.masterData.addGroupMember(tenantId, groupId, employeeId);
  }

  @Delete(":groupId/members/:employeeId")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  removeMember(
    @TenantId() tenantId: string,
    @Param("groupId") groupId: string,
    @Param("employeeId") employeeId: string
  ) {
    return this.masterData.removeGroupMember(tenantId, groupId, employeeId);
  }
}
