import { existsSync } from "fs";
import { resolve } from "path";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { AppModule } from "./app.module";

const envPaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"]
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  Logger.log(`API http://localhost:${port}/api/v1 (e.g. POST /api/v1/auth/login)`, "Bootstrap");
}

void bootstrap();
