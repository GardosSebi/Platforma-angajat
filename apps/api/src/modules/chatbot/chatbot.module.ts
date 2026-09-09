import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { MailModule } from "../../infrastructure/mail/mail.module";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { FilesModule } from "../../infrastructure/files/files.module";
import { CommunicationsController } from "./api/communications.controller";
import { CommunicationRightsController } from "./api/communication-rights.controller";
import { CommunicationChatController } from "./api/communication-chat.controller";
import { CommunicationsService } from "./application/services/communications.service";
import { CommunicationRightsService } from "./application/services/communication-rights.service";
import { CommunicationChatService } from "./application/services/communication-chat.service";

@Module({
  imports: [NotificationsModule, MailModule, FilesModule],
  controllers: [CommunicationsController, CommunicationRightsController, CommunicationChatController],
  providers: [PermissionsGuard, CommunicationsService, CommunicationRightsService, CommunicationChatService],
  exports: [CommunicationsService, CommunicationRightsService]
})
export class ChatbotModule {}
