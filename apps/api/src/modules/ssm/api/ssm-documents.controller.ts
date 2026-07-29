import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SsmDocumentType } from "@prisma/client";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { JwtPayload } from "../../../auth/jwt.strategy";
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
import {
  CreateSsmDocumentTemplateDto,
  UpdateSsmDocumentTemplateDto
} from "./dto/ssm-document-template.dto";
import { UpsertSsmDocumentTypePolicyDto } from "./dto/ssm-document-type-policy.dto";

@Controller("ssm/documents")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmDocumentsController {
  constructor(private readonly documentsService: SsmDocumentsService) {}

  @Get("types")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  listTypes() {
    return {
      types: SsmDocumentsService.documentTypes(),
      targets: SsmDocumentsService.documentTargets(),
      moduleHints: this.documentsService.documentModuleHints()
    };
  }

  @Get("policies")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  listPolicies(@TenantId() tenantId: string) {
    return this.documentsService.listTypePolicies(tenantId);
  }

  @Put("policies/:documentType")
  @RequirePermissions(Permission.SSM_DOCUMENT_APPROVE)
  upsertPolicy(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("documentType") documentType: SsmDocumentType,
    @Body() dto: UpsertSsmDocumentTypePolicyDto
  ) {
    return this.documentsService.upsertTypePolicy(tenantId, user.sub, documentType, dto);
  }

  @Post("policies/seed-defaults")
  @RequirePermissions(Permission.SSM_DOCUMENT_APPROVE)
  seedPolicies(@TenantId() tenantId: string) {
    return this.documentsService.seedDefaultTypePolicies(tenantId);
  }

  @Get()
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  list(@TenantId() tenantId: string, @Query() query: ListSsmDocumentsDto, @CurrentUser() user: JwtPayload) {
    return this.documentsService.listDocuments(tenantId, query, user);
  }

  @Get("control/quick-access")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  quickControlAccess(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.documentsService.quickControlAccess(tenantId, user);
  }

  @Get("templates")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  listTemplates(@TenantId() tenantId: string) {
    return this.documentsService.listTemplates(tenantId);
  }

  @Post("templates/seed-defaults")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  seedTemplates(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.documentsService.seedDefaultTemplates(tenantId, user.sub);
  }

  @Post("templates")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  createTemplate(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmDocumentTemplateDto
  ) {
    return this.documentsService.createTemplate(tenantId, user.sub, dto);
  }

  @Patch("templates/:templateId")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT)
  updateTemplate(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("templateId") templateId: string,
    @Body() dto: UpdateSsmDocumentTemplateDto
  ) {
    return this.documentsService.updateTemplate(tenantId, user.sub, templateId, dto);
  }

  @Post("templates/:templateId/file")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  uploadTemplateFile(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("templateId") templateId: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.documentsService.uploadTemplateFile(tenantId, user.sub, templateId, file);
  }

  @Get("templates/:templateId/file")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  @Header("Cache-Control", "private, max-age=300")
  async downloadTemplateFile(@TenantId() tenantId: string, @Param("templateId") templateId: string) {
    const { stream, mimeType, fileName } = await this.documentsService.streamTemplateFile(
      tenantId,
      templateId
    );
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `attachment; filename="${encodeURIComponent(fileName)}"`
    });
  }

  @Post("templates/:templateId/create-document")
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  createFromTemplate(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("templateId") templateId: string,
    @Body() body: { title?: string; targetLabel?: string }
  ) {
    return this.documentsService.createDocumentFromTemplate(tenantId, user.sub, templateId, user, body);
  }

  @Get(":id/history")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  history(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.documentsService.getDocumentHistory(tenantId, id, user);
  }

  @Get(":id/versions/:versionId/file")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  @Header("Cache-Control", "private, max-age=300")
  async downloadVersionFile(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("versionId") versionId: string
  ) {
    const { stream, mimeType, fileName } = await this.documentsService.streamDocumentVersion(
      tenantId,
      id,
      versionId,
      user
    );
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `inline; filename="${encodeURIComponent(fileName)}"`
    });
  }

  @Get(":id/file")
  @RequirePermissions(Permission.SSM_DOCUMENT_VIEW)
  @Header("Cache-Control", "private, max-age=300")
  async downloadActiveFile(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    const { stream, mimeType, fileName } = await this.documentsService.streamActiveVersion(tenantId, id, user);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `inline; filename="${encodeURIComponent(fileName)}"`
    });
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSsmDocumentDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.documentsService.createDocument(tenantId, user.sub, dto, file, user);
  }

  @Post(":id/versions")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermissions(Permission.SSM_DOCUMENT_EDIT, Permission.FILES_UPLOAD)
  addVersion(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body("changeNote") changeNote: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.documentsService.addVersion(tenantId, user.sub, id, changeNote, file, user);
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
