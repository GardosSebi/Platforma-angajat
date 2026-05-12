import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CommunicationsController } from "./api/communications.controller";
import { CommunicationsService } from "./application/services/communications.service";

@Module({
  controllers: [CommunicationsController],
  providers: [PermissionsGuard, CommunicationsService]
})
export class ChatbotModule {}
