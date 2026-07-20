import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

class LdapLoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class AzureCallbackDto {
  @IsString()
  code!: string;
}

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

  @Get("sso/status")
  async ssoStatus(@Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined) {
    const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
    if (!tenantId) {
      throw new UnauthorizedException("Missing x-tenant-id header");
    }
    return this.authService.getSsoStatus(tenantId);
  }

  @Post("sso/ldap")
  async ldapLogin(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: LdapLoginDto
  ) {
    const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
    if (!tenantId) {
      throw new UnauthorizedException("Missing x-tenant-id header");
    }
    return this.authService.loginWithLdap(tenantId, dto.username, dto.password);
  }

  @Post("sso/azure/callback")
  async azureCallback(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: AzureCallbackDto,
    @Query("tenantId") tenantIdQuery?: string
  ) {
    const fromHeader = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
    const tenantId = fromHeader || tenantIdQuery;
    if (!tenantId) {
      throw new UnauthorizedException("Missing tenant id");
    }
    return this.authService.loginWithAzureCode(tenantId, dto.code);
  }
}
