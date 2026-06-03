import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PublicSurveysController, SurveysController } from "./api/surveys.controller";
import { SurveysService } from "./application/services/surveys.service";

@Module({
  controllers: [SurveysController, PublicSurveysController],
  providers: [PermissionsGuard, SurveysService],
  exports: [SurveysService]
})
export class SurveysModule {}
