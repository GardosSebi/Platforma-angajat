import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { SecurityModule } from "./infrastructure/security/security.module";
import { SsmModule } from "./modules/ssm/ssm.module";
import { ChatbotModule } from "./modules/chatbot/chatbot.module";
import { SurveysModule } from "./modules/surveys/surveys.module";
import { TicketingModule } from "./modules/ticketing/ticketing.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    PrismaModule,
    LoggingModule,
    SecurityModule,
    AuthModule,
    SsmModule,
    ChatbotModule,
    SurveysModule,
    TicketingModule
  ]
})
export class AppModule {}
