import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateDepartmentDto } from "../dto/create-department.dto";
import { UpdateDepartmentDto } from "../dto/update-department.dto";

@Controller("master-data/departments")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string) {
    return this.masterData.listDepartments(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateDepartmentDto) {
    return this.masterData.createDepartment(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.masterData.updateDepartment(tenantId, id, dto);
  }
}
