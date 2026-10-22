import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../../../common/decorators/require-any-permissions.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmConventionsService } from "../application/services/ssm-conventions.service";
import {
  CreateSsmConventionDto,
  CreateSsmConventionPartyDto,
  ListSsmConventionsDto,
  SignSsmConventionPartyDto,
  TerminateSsmConventionDto,
  UpdateSsmConventionDto,
  UpdateSsmConventionPartyDto
} from "./dto/ssm-conventions.dto";

@Controller("ssm/conventions")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmConventionsController {
  constructor(private readonly conventions: SsmConventionsService) {}

  @Get()
  @RequireAnyPermissions(Permission.SSM_DOCUMENT_EDIT, Permission.SSM_REPORT_VIEW)
  list(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Query() query: ListSsmConventionsDto) {
    return this.conventions.list(tenantId, user.sub, query);
  }

  @Post()
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateSsmConventionDto) {
    return this.conventions.create(tenantId, user.sub, dto);
  }

  @Get(":id")
  @RequireAnyPermissions(Permission.SSM_DOCUMENT_EDIT, Permission.SSM_REPORT_VIEW)
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.conventions.get(tenantId, id);
  }

  @Patch(":id")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateSsmConventionDto
  ) {
    return this.conventions.update(tenantId, user.sub, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  remove(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.conventions.remove(tenantId, user.sub, id);
  }

  @Post(":id/parties")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  addParty(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: CreateSsmConventionPartyDto
  ) {
    return this.conventions.addParty(tenantId, user.sub, id, dto);
  }

  @Patch(":id/parties/:partyId")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  updateParty(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("partyId") partyId: string,
    @Body() dto: UpdateSsmConventionPartyDto
  ) {
    return this.conventions.updateParty(tenantId, user.sub, id, partyId, dto);
  }

  @Delete(":id/parties/:partyId")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  removeParty(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("partyId") partyId: string
  ) {
    return this.conventions.removeParty(tenantId, user.sub, id, partyId);
  }

  @Patch(":id/parties/:partyId/sign")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  signParty(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("partyId") partyId: string,
    @Body() dto: SignSsmConventionPartyDto
  ) {
    return this.conventions.signParty(tenantId, user.sub, id, partyId, dto);
  }

  @Post(":id/activate")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  activate(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.conventions.activate(tenantId, user.sub, id);
  }

  @Post(":id/terminate")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  terminate(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: TerminateSsmConventionDto
  ) {
    return this.conventions.terminate(tenantId, user.sub, id, dto);
  }

  @Get(":id/pdf")
  @RequireAnyPermissions(Permission.SSM_DOCUMENT_EDIT, Permission.SSM_REPORT_VIEW)
  @Header("Content-Type", "application/pdf")
  async pdf(@TenantId() tenantId: string, @Param("id") id: string) {
    const { buffer, fileName } = await this.conventions.pdf(tenantId, id);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${fileName}"` });
  }
}
