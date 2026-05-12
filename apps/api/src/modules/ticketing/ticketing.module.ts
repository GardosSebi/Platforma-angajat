import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TicketingController } from "./api/ticketing.controller";
import { TicketingService } from "./application/services/ticketing.service";

@Module({
  controllers: [TicketingController],
  providers: [PermissionsGuard, TicketingService]
})
export class TicketingModule {}
