import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertTenantSsoConfigDto {
  @IsOptional()
  @IsBoolean()
  azureEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  azureTenantId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  azureClientId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  azureClientSecret?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  azureRedirectUri?: string | null;

  @IsOptional()
  @IsBoolean()
  ldapEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  ldapUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  ldapBaseDn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  ldapBindDn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ldapBindPassword?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ldapSearchFilter?: string | null;
}
