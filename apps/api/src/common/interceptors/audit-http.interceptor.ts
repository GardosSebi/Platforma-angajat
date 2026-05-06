import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { JwtPayload } from "../../auth/jwt.strategy";
import { AuditLogService } from "../../infrastructure/logging/audit-log.service";

/** Audit HTTP pentru upload fișiere și import master data (restul în use-case-uri). */
const AUDIT_PREFIXES = ["/api/v1/files"];

@Injectable()
export class AuditHttpInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const method = request.method;
    const path = request.originalUrl || request.url;

    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next.handle();
    }
    if (!AUDIT_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const tenantHeader = request.headers["x-tenant-id"];
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
    const user = request.user;

    return next.handle().pipe(
      tap({
        next: () => {
          void (async () => {
            if (!tenantId || !user?.sub) {
              return;
            }
            await this.auditLog.write({
              tenantId,
              actorId: user.sub,
              module: "HTTP",
              action: `${method} ${path}`,
              entityType: "HttpRequest",
              entityId: "-",
              payload: {
                path,
                method
              }
            });
          })();
        }
      })
    );
  }
}
