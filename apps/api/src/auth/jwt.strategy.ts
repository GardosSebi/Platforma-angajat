import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-jwt-secret"
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.tenantId) {
      throw new UnauthorizedException("Tenant is missing in JWT");
    }
    return {
      ...payload,
      roles: payload.roles ?? []
    };
  }
}
