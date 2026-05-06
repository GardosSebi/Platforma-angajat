import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { JwtPayload } from "./jwt.strategy";

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const headerTenant = request.headers["x-tenant-id"];
    const tenantId = Array.isArray(headerTenant) ? headerTenant[0] : headerTenant;
    const tokenTenant = request.user?.tenantId;

    if (!tenantId || !tokenTenant || tenantId !== tokenTenant) {
      throw new UnauthorizedException("Tenant mismatch");
    }
    return true;
  }
}
