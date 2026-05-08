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
import { SsmDocumentsService } from "../application/services/ssm-documents.service";
import { CreateSsmDocumentDto } from "./dto/create-ssm-document.dto";
import { ListSsmDocumentsDto } from "./dto/list-ssm-documents.dto";
import { RevertSsmDocumentDto } from "./dto/revert-ssm-document.dto";

@Controller("ssm/documents")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmDocumentsController {
  constructor(private readonly documentsService: SsmDocumentsService) {}

  @Get("types")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  listTypes() {
    return {
      types: SsmDocumentsService.documentTypes(),
      targets: SsmDocumentsService.documentTargets()
    };
  }

  @Get()
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  list(@TenantId() tenantId: string, @Query() query: ListSsmDocumentsDto) {
    return this.documentsService.listDocuments(tenantId, query);
  }

  @Get("control/quick-access")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  quickControlAccess(@TenantId() tenantId: string) {
    return this.documentsService.quickControlAccess(tenantId);
  }

  @Get(":id/history")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  history(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.documentsService.getDocumentHistory(tenantId, id);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmDocumentDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.documentsService.createDocument(tenantId, user.sub, dto, file);
  }

  @Post(":id/versions")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  addVersion(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body("changeNote") changeNote: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.documentsService.addVersion(tenantId, user.sub, id, changeNote, file);
  }

  @Patch(":id/revert")
  @RequirePermissions(Permission.SSM_DOCUMENT_APPROVE)
  revert(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: RevertSsmDocumentDto
  ) {
    return this.documentsService.revertToVersion(tenantId, user.sub, id, dto.versionId, dto.changeNote);
  }

  @Patch(":id/archive")
  @RequirePermissions(Permission.SSM_DOCUMENT_APPROVE)
  archive(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.documentsService.archiveDocument(tenantId, user.sub, id);
  }
}
