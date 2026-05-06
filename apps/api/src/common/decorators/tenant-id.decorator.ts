import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const tenantId = request.headers["x-tenant-id"];
  return Array.isArray(tenantId) ? tenantId[0] : tenantId;
});
