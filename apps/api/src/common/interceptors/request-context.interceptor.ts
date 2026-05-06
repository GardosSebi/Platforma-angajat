import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppLoggerService } from "../../infrastructure/logging/app-logger.service";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestId = (request.headers["x-request-id"] as string) || randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);

    const started = Date.now();
    const { method, originalUrl } = request;

    this.logger.log(
      JSON.stringify({ method, path: originalUrl, requestId }),
      "HTTP"
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(
            JSON.stringify({
              method,
              path: originalUrl,
              requestId,
              statusCode: response.statusCode,
              durationMs: ms
            }),
            "HTTP"
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - started;
          this.logger.error(
            JSON.stringify({
              method,
              path: originalUrl,
              requestId,
              durationMs: ms,
              message: err.message
            }),
            err.stack,
            "HTTP"
          );
        }
      })
    );
  }
}
