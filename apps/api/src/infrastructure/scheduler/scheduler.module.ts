import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ChatbotModule } from "../../modules/chatbot/chatbot.module";
import { SsmModule } from "../../modules/ssm/ssm.module";
import { RetentionModule } from "../retention/retention.module";
import { PlatformCronService } from "./platform-cron.service";

@Module({
  imports: [ScheduleModule.forRoot(), SsmModule, ChatbotModule, RetentionModule],
  providers: [PlatformCronService],
  exports: [PlatformCronService]
})
export class SchedulerModule {}
