import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { LocalFileStorageService } from "./local-file-storage.service";
import { PermissionsGuard } from "../../common/guards/permissions.guard";

@Module({
  controllers: [FilesController],
  providers: [LocalFileStorageService, PermissionsGuard],
  exports: [LocalFileStorageService]
})
export class FilesModule {}
