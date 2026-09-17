import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmSubstancesService } from "../application/services/ssm-substances.service";
import { CreateSsmDangerousSubstanceDto, UpdateSsmDangerousSubstanceDto } from "./dto/ssm-substances.dto";

@Controller("ssm/substances")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmSubstancesController {
  constructor(private readonly substances: SsmSubstancesService) {}

  @Get()
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  list(@TenantId() tenantId: string, @Query("worksiteId") worksiteId?: string) {
    return this.substances.list(tenantId, worksiteId);
  }

  @Post()
  @UseInterceptors(FileInterceptor("sdsSheet"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmDangerousSubstanceDto,
    @UploadedFile() sdsSheet?: Express.Multer.File
  ) {
    return this.substances.create(tenantId, user.sub, dto, sdsSheet);
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("sdsSheet"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateSsmDangerousSubstanceDto,
    @UploadedFile() sdsSheet?: Express.Multer.File
  ) {
    return this.substances.update(tenantId, user.sub, id, dto, sdsSheet);
  }

  @Patch(":id/retire")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  retire(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.substances.retire(tenantId, user.sub, id);
  }

  @Get(":id/sds-sheet")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  downloadSds(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.substances.downloadSds(tenantId, id);
  }
}
