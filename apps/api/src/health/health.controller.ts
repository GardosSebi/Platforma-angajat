import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  live() {
    return { status: "ok", ts: new Date().toISOString() };
  }

  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up", ts: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
}
