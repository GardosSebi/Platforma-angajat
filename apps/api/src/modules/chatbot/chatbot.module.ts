import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { CommunicationsController } from "./api/communications.controller";
import { CommunicationRightsController } from "./api/communication-rights.controller";
import { CommunicationsService } from "./application/services/communications.service";
import { CommunicationRightsService } from "./application/services/communication-rights.service";

@Module({
  imports: [NotificationsModule],
  controllers: [CommunicationsController, CommunicationRightsController],
  providers: [PermissionsGuard, CommunicationsService, CommunicationRightsService],
  exports: [CommunicationsService, CommunicationRightsService]
})
export class ChatbotModule {}
