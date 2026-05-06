import { Global, Module } from "@nestjs/common";
import { AppLoggerService } from "./app-logger.service";
import { AuditLogService } from "./audit-log.service";

@Global()
@Module({
  providers: [AppLoggerService, AuditLogService],
  exports: [AppLoggerService, AuditLogService]
})
export class LoggingModule {}
