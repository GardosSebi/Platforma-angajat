import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../../../../.env"),
  resolve(__dirname, "../../../../../.env")
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing. Ensure .env is available for apps/api runtime.");
    }
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.once("beforeExit", () => {
      void app.close();
    });
  }
}
