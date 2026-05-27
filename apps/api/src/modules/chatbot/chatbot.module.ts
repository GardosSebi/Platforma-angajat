import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { CommunicationsController } from "./api/communications.controller";
import { CommunicationsService } from "./application/services/communications.service";

@Module({
  imports: [NotificationsModule],
  controllers: [CommunicationsController],
  providers: [PermissionsGuard, CommunicationsService],
  exports: [CommunicationsService]
})
export class ChatbotModule {}
