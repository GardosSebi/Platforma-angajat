import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
import { EmployeeStaticAudienceType } from "../../../../common/prisma-enums";

const AUDIENCES = Object.values(EmployeeStaticAudienceType);

export class CreateStaticPageDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase kebab-case" })
  slug!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  bodyMarkdown!: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audienceType?: EmployeeStaticAudienceType;

  @IsOptional()
  @IsString()
  audienceRefId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  attachmentName?: string | null;

  @IsOptional()
  @IsString()
  attachmentPath?: string | null;

  @IsOptional()
  @IsString()
  attachmentMime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  attachmentSize?: number | null;
}

export class UpdateStaticPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase kebab-case" })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  bodyMarkdown?: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audienceType?: EmployeeStaticAudienceType;

  @IsOptional()
  @IsString()
  audienceRefId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  attachmentName?: string | null;

  @IsOptional()
  @IsString()
  attachmentPath?: string | null;

  @IsOptional()
  @IsString()
  attachmentMime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  attachmentSize?: number | null;
}
