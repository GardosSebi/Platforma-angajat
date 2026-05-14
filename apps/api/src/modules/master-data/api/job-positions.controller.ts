import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Permission } from "../../../common/constants/permissions";
import { MasterDataService } from "../master-data.service";
import { CreateJobPositionDto } from "../dto/create-job-position.dto";
import { UpdateJobPositionDto } from "../dto/update-job-position.dto";

@Controller("master-data/job-positions")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class JobPositionsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  list(@TenantId() tenantId: string) {
    return this.masterData.listJobPositions(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  create(@TenantId() tenantId: string, @Body() dto: CreateJobPositionDto) {
    return this.masterData.createJobPosition(tenantId, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.MASTER_DATA_WRITE)
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateJobPositionDto) {
    return this.masterData.updateJobPosition(tenantId, id, dto);
  }
}
