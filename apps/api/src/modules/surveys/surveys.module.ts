import { Controller, Get, Module } from "@nestjs/common";

@Controller("surveys")
class SurveysController {
  @Get("health")
  health() {
    return { module: "surveys", status: "ok" };
  }
}

@Module({
  controllers: [SurveysController]
})
export class SurveysModule {}
