import { Controller, Get, Module } from "@nestjs/common";

@Controller("ticketing")
class TicketingController {
  @Get("health")
  health() {
    return { module: "ticketing", status: "ok" };
  }
}

@Module({
  controllers: [TicketingController]
})
export class TicketingModule {}
