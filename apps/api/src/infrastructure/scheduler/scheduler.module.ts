import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ChatbotModule } from "../../modules/chatbot/chatbot.module";
import { SurveysModule } from "../../modules/surveys/surveys.module";
import { SsmModule } from "../../modules/ssm/ssm.module";
import { RetentionModule } from "../retention/retention.module";
import { PlatformCronService } from "./platform-cron.service";

@Module({
  imports: [ScheduleModule.forRoot(), SsmModule, ChatbotModule, SurveysModule, RetentionModule],
  providers: [PlatformCronService],
  exports: [PlatformCronService]
})
export class SchedulerModule {}
