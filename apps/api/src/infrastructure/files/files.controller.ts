import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { TenantGuard } from "../../auth/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { Permission } from "../../common/constants/permissions";
import { LocalFileStorageService } from "./local-file-storage.service";
import { JwtPayload } from "../../auth/jwt.strategy";

@Controller("files")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class FilesController {
  constructor(private readonly storage: LocalFileStorageService) {}

  @Post("upload")
  @RequirePermissions(Permission.FILES_UPLOAD)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }
    })
  )
  async upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Missing multipart field 'file'");
    }
    const saved = await this.storage.saveUploadedFile({
      tenantId,
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype
    });
    return {
      fileId: saved.id,
      path: saved.relativePath,
      size: saved.size,
      uploadedBy: user.sub
    };
  }
}
