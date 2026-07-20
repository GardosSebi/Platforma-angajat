import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Client as LdapClient } from "ldapts";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { JwtPayload } from "./jwt.strategy";
import { SystemRole } from "../common/prisma-enums";

type UserRow = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  active: boolean;
  roles: string[];
  fullName: string | null;
  authProvider: string;
  externalId: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  private jwtExpiresInLabel(): string {
    return this.config.get<string>("JWT_EXPIRES_IN")?.trim() || "8h";
  }

  async login(tenantId: string, email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.authProvider !== "LOCAL" && user.authProvider !== "LDAP") {
      throw new UnauthorizedException("This account uses SSO. Sign in with Azure AD or LDAP.");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueSession(user as UserRow);
  }

  async getSsoStatus(tenantId: string) {
    const config = await this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } });
    const azureEnabled = Boolean(config?.azureEnabled && config.azureClientId && config.azureTenantId);
    const ldapEnabled = Boolean(config?.ldapEnabled && config.ldapUrl && config.ldapBaseDn);
    let azureAuthorizeUrl: string | null = null;
    if (azureEnabled && config) {
      const redirect = encodeURIComponent(config.azureRedirectUri || this.defaultAzureRedirect());
      const clientId = encodeURIComponent(config.azureClientId!);
      const state = encodeURIComponent(Buffer.from(JSON.stringify({ tenantId })).toString("base64url"));
      azureAuthorizeUrl = `https://login.microsoftonline.com/${config.azureTenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&response_mode=query&scope=${encodeURIComponent("openid profile email offline_access")}&state=${state}`;
    }
    return { azureEnabled, ldapEnabled, azureAuthorizeUrl };
  }

  async loginWithLdap(tenantId: string, username: string, password: string) {
    const config = await this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } });
    if (!config?.ldapEnabled || !config.ldapUrl || !config.ldapBaseDn) {
      throw new UnauthorizedException("LDAP is not enabled for this tenant.");
    }

    const filter = (config.ldapSearchFilter || "(mail={{username}})").replace(
      /\{\{username\}\}/g,
      username.replace(/[\\*()]/g, "")
    );

    const client = new LdapClient({ url: config.ldapUrl });
    try {
      if (config.ldapBindDn && config.ldapBindPassword) {
        await client.bind(config.ldapBindDn, config.ldapBindPassword);
      }
      const search = await client.search(config.ldapBaseDn, {
        scope: "sub",
        filter,
        attributes: ["dn", "mail", "displayName", "cn", "uid"]
      });
      const entry = search.searchEntries[0];
      if (!entry?.dn) {
        throw new UnauthorizedException("Invalid LDAP credentials");
      }
      const userDn = String(entry.dn);
      await client.bind(userDn, password);

      const mailAttr = entry.mail;
      const email = (
        Array.isArray(mailAttr) ? String(mailAttr[0]) : mailAttr ? String(mailAttr) : username
      ).toLowerCase();
      const display =
        (entry.displayName && String(Array.isArray(entry.displayName) ? entry.displayName[0] : entry.displayName)) ||
        (entry.cn && String(Array.isArray(entry.cn) ? entry.cn[0] : entry.cn)) ||
        email;

      const user = await this.upsertExternalUser(tenantId, email, display, "LDAP", userDn);
      return this.issueSession(user);
    } catch (error) {
      this.logger.warn(`LDAP login failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException("Invalid LDAP credentials");
    } finally {
      try {
        await client.unbind();
      } catch {
        /* ignore */
      }
    }
  }

  async loginWithAzureCode(tenantId: string, code: string) {
    const config = await this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } });
    if (!config?.azureEnabled || !config.azureClientId || !config.azureTenantId || !config.azureClientSecret) {
      throw new UnauthorizedException("Azure AD is not enabled for this tenant.");
    }

    const redirectUri = config.azureRedirectUri || this.defaultAzureRedirect();
    const tokenUrl = `https://login.microsoftonline.com/${config.azureTenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: config.azureClientId,
      client_secret: config.azureClientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "openid profile email offline_access"
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!tokenRes.ok) {
      this.logger.warn(`Azure token exchange failed: ${await tokenRes.text()}`);
      throw new UnauthorizedException("Azure AD authentication failed");
    }
    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!profileRes.ok) {
      throw new UnauthorizedException("Could not load Azure AD profile");
    }
    const profile = (await profileRes.json()) as {
      id?: string;
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    const email = (profile.mail || profile.userPrincipalName || "").toLowerCase();
    if (!email) throw new UnauthorizedException("Azure AD profile has no email");

    const user = await this.upsertExternalUser(
      tenantId,
      email,
      profile.displayName || email,
      "AZURE_AD",
      profile.id || email
    );
    return this.issueSession(user);
  }

  private defaultAzureRedirect(): string {
    return this.config.get<string>("AZURE_REDIRECT_URI")?.trim() || "http://localhost:5173/login";
  }

  private async upsertExternalUser(
    tenantId: string,
    email: string,
    fullName: string,
    provider: string,
    externalId: string
  ): Promise<UserRow> {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } }
    });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          authProvider: provider,
          externalId,
          fullName: existing.fullName || fullName,
          active: true
        }
      }) as Promise<UserRow>;
    }

    const passwordHash = await bcrypt.hash(`sso-${provider}-${externalId}-${Date.now()}`, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        fullName,
        passwordHash,
        roles: [SystemRole.EMPLOYEE],
        authProvider: provider,
        externalId,
        active: true
      }
    }) as Promise<UserRow>;
  }

  private async issueSession(user: UserRow) {
    if (!user.active) throw new UnauthorizedException("Invalid credentials");

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: [...user.roles]
    };

    const accessToken = await this.jwt.signAsync(payload);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const linkedEmployee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        active: true,
        email: { equals: user.email, mode: "insensitive" }
      },
      select: { id: true }
    });

    return {
      accessToken,
      expiresIn: this.jwtExpiresInLabel(),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: user.roles
      },
      linkedEmployeeId: linkedEmployee?.id ?? null
    };
  }
}
