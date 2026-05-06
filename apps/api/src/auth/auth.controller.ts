import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: LoginDto
  ) {
    const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
    if (!tenantId) {
      throw new UnauthorizedException("Missing x-tenant-id header");
    }
    return this.authService.login(tenantId, dto.email, dto.password);
  }
}
