import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/password-reset.dto";

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

  private resolveTenantId(
    tenantIdHeader: string | string[] | undefined,
    tenantIdQuery?: string
  ): string {
    const fromHeader = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
    const tenantId = fromHeader || tenantIdQuery;
    if (!tenantId) {
      throw new UnauthorizedException("Missing x-tenant-id header");
    }
    return tenantId;
  }

  @Post("login")
  async login(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: LoginDto
  ) {
    const tenantId = this.resolveTenantId(tenantIdHeader);
    return this.authService.login(tenantId, dto.email, dto.password);
  }

  @Post("forgot-password")
  async forgotPassword(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: ForgotPasswordDto
  ) {
    const tenantId = this.resolveTenantId(tenantIdHeader);
    return this.authService.requestPasswordReset(tenantId, dto.email);
  }

  @Post("reset-password")
  async resetPassword(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: ResetPasswordDto
  ) {
    const tenantId = this.resolveTenantId(tenantIdHeader);
    return this.authService.resetPassword(tenantId, dto.token, dto.password);
  }

  @Get("sso/status")
  async ssoStatus(@Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined) {
    const tenantId = this.resolveTenantId(tenantIdHeader);
    return this.authService.getSsoStatus(tenantId);
  }

  @Post("sso/ldap")
  async ldapLogin(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: LdapLoginDto
  ) {
    const tenantId = this.resolveTenantId(tenantIdHeader);
    return this.authService.loginWithLdap(tenantId, dto.username, dto.password);
  }

  @Post("sso/azure/callback")
  async azureCallback(
    @Headers("x-tenant-id") tenantIdHeader: string | string[] | undefined,
    @Body() dto: AzureCallbackDto,
    @Query("tenantId") tenantIdQuery?: string
  ) {
    const tenantId = this.resolveTenantId(tenantIdHeader, tenantIdQuery);
    return this.authService.loginWithAzureCode(tenantId, dto.code);
  }
}
