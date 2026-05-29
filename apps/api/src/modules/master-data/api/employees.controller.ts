import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { ListEmployeeOptionsDto } from "../dto/list-employee-options.dto";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { hasAllPermissions, Permission } from "../../../common/constants/permissions";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { MasterDataService } from "../master-data.service";
import { CreateEmployeeDto } from "../dto/create-employee.dto";
import { UpdateEmployeeDto } from "../dto/update-employee.dto";
import { UpdatePlacementDto } from "../dto/update-placement.dto";

@Controller("master-data/employees")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly masterData: MasterDataService) {}

  private revealCnp(user: JwtPayload): boolean {
    return hasAllPermissions(user.roles, [Permission.MASTER_DATA_WRITE]);
  }

  @Get("options")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  listOptions(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListEmployeeOptionsDto
  ) {
    return this.masterData.listEmployeeOptions(tenantId, query.search, query.limit, user);
  }

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto
  ) {
    return this.masterData.listEmployees(tenantId, this.revealCnp(user), query, user);
  }

  @Get(":id")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  getOne(@TenantId() tenantId: string, @Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.masterData.getEmployee(tenantId, id, this.revealCnp(user), user);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEmployeeDto
  ) {
    return this.masterData.createEmployee(tenantId, dto, user.sub);
  }

  @Patch(":id/placement")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  updatePlacement(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePlacementDto
  ) {
    return this.masterData.updatePlacement(tenantId, id, dto, user.sub);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEmployeeDto
  ) {
    return this.masterData.updateEmployee(tenantId, id, dto, user.sub);
  }
}
