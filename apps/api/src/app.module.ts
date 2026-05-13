import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { AuditHttpInterceptor } from "./common/interceptors/audit-http.interceptor";
import { RequestContextInterceptor } from "./common/interceptors/request-context.interceptor";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { FilesModule } from "./infrastructure/files/files.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { MailModule } from "./infrastructure/mail/mail.module";
import { SecurityModule } from "./infrastructure/security/security.module";
import { SsmModule } from "./modules/ssm/ssm.module";
import { ChatbotModule } from "./modules/chatbot/chatbot.module";
import { SurveysModule } from "./modules/surveys/surveys.module";
import { TicketingModule } from "./modules/ticketing/ticketing.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { PlatformAdminModule } from "./modules/platform-admin/platform-admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    PrismaModule,
    LoggingModule,
    SecurityModule,
    MailModule,
    HealthModule,
    FilesModule,
    AuthModule,
    MasterDataModule,
    PlatformAdminModule,
    SsmModule,
    ChatbotModule,
    SurveysModule,
    TicketingModule
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditHttpInterceptor }
  ]
})
export class AppModule {}
