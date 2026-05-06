import { Injectable, LoggerService } from "@nestjs/common";

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string) {
    console.log(JSON.stringify({ level: "info", context, message }));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(JSON.stringify({ level: "error", context, message, trace }));
  }

  warn(message: string, context?: string) {
    console.warn(JSON.stringify({ level: "warn", context, message }));
  }
}
