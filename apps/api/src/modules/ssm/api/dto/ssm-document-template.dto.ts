import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SsmDocumentTargetType, SsmDocumentType } from "@prisma/client";

const DOCUMENT_TYPES = [
  "IPSSM",
  "RISK_ASSESSMENT",
  "PPP",
  "THEMATIC",
  "DECISION",
  "PSI",
  "REGISTER",
  "OTHER"
] as const;

const TARGET_TYPES = ["JOB_POSITION", "DEPARTMENT", "WORKSITE", "ENTITY", "ALL"] as const;

export class CreateSsmDocumentTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title!: string;

  @IsIn(DOCUMENT_TYPES)
  type!: SsmDocumentType;

  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: SsmDocumentTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  targetLabel?: string;

  @IsOptional()
  @IsBoolean()
  isControlFolder?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistItems?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSsmDocumentTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: SsmDocumentType;

  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: SsmDocumentTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  targetLabel?: string;

  @IsOptional()
  @IsBoolean()
  isControlFolder?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistItems?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
