import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { JwtPayload } from "../../auth/jwt.strategy";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { PERMISSIONS_ANY_KEY } from "../decorators/require-any-permissions.decorator";
import { hasAllPermissions, hasAnyPermission } from "../constants/permissions";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAny = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;
    if (!user?.roles?.length) {
      throw new ForbiddenException("Missing roles");
    }

    if (requiredAny && requiredAny.length > 0) {
      if (!hasAnyPermission(user.roles, requiredAny)) {
        throw new ForbiddenException("Insufficient permissions");
      }
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    if (!hasAllPermissions(user.roles, required)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
