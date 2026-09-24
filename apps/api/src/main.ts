import { existsSync } from "fs";
import { resolve } from "path";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";

const envPaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

async function bootstrap() {
  const { AppModule } = await import("./app.module");
  const { JWT_EXPIRES_IN_LABEL, JWT_EXPIRES_IN_SECONDS } = await import("./auth/jwt.constants");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id", "x-worksite-id"]
  });
  const { validationExceptionFactory } = await import("./common/validation-messages");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory
    })
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  Logger.log(`API http://localhost:${port}/api/v1 (e.g. POST /api/v1/auth/login)`, "Bootstrap");
  Logger.log(`JWT access token TTL: ${JWT_EXPIRES_IN_LABEL} (${JWT_EXPIRES_IN_SECONDS}s)`, "Bootstrap");
  const { isCronEnabled } = await import("./infrastructure/scheduler/scheduler.constants");
  Logger.log(
    `Cron jobs: ${isCronEnabled() ? "enabled" : "disabled (CRON_ENABLED=false)"}`,
    "Bootstrap"
  );
}

void bootstrap();
