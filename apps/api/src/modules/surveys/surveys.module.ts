import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { MailModule } from "../../infrastructure/mail/mail.module";
import { PublicSurveysController, SurveysController } from "./api/surveys.controller";
import { SurveysService } from "./application/services/surveys.service";

@Module({
  imports: [MailModule],
  controllers: [SurveysController, PublicSurveysController],
  providers: [PermissionsGuard, SurveysService],
  exports: [SurveysService]
})
export class SurveysModule {}
