import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { MailModule } from "../../infrastructure/mail/mail.module";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { TicketingController } from "./api/ticketing.controller";
import { TicketingService } from "./application/services/ticketing.service";

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [TicketingController],
  providers: [PermissionsGuard, TicketingService]
})
export class TicketingModule {}
