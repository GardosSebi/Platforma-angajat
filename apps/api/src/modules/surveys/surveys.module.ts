import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { FilesModule } from "../../infrastructure/files/files.module";
import { MailModule } from "../../infrastructure/mail/mail.module";
import { PublicSurveysController, SurveysController } from "./api/surveys.controller";
import { SurveysService } from "./application/services/surveys.service";

@Module({
  imports: [MailModule, FilesModule],
  controllers: [SurveysController, PublicSurveysController],
  providers: [PermissionsGuard, SurveysService],
  exports: [SurveysService]
})
export class SurveysModule {}
