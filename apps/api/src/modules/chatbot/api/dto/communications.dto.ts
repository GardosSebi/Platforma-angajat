import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const CONTENT_TYPES = ["TEXT", "RICH_TEXT", "LINK", "DOCUMENT", "SURVEY"] as const;
const CATEGORIES = ["GENERAL", "SAFETY_ALERT", "POLICY", "TRAINING_INFO", "SSM_COMPLIANCE", "HR_INFO"] as const;
const AUDIENCE_TYPES = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE_GROUP", "EMPLOYEE", "CUSTOM"] as const;
const CREATE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
const UPDATE_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"] as const;

type ContentTypeCode = (typeof CONTENT_TYPES)[number];
type CategoryCode = (typeof CATEGORIES)[number];
type AudienceTypeCode = (typeof AUDIENCE_TYPES)[number];
type CreateStatusCode = (typeof CREATE_STATUSES)[number];
type UpdateStatusCode = (typeof UPDATE_STATUSES)[number];

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: CategoryCode;

  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: ContentTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  contentUrl?: string;

  @IsIn(AUDIENCE_TYPES)
  audienceType!: AudienceTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audienceRefId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  audienceLabel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetEmployeeIds?: string[];

  @IsOptional()
  @IsIn(CREATE_STATUSES)
  status?: CreateStatusCode;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateId?: string;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  body?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: CategoryCode;

  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: ContentTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  contentUrl?: string;

  @IsOptional()
  @IsIn(AUDIENCE_TYPES)
  audienceType?: AudienceTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audienceRefId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  audienceLabel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetEmployeeIds?: string[];

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: UpdateStatusCode;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;
}

export class MarkAnnouncementReadDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: CategoryCode;

  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: ContentTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  contentUrl?: string;

  @IsOptional()
  @IsIn(AUDIENCE_TYPES)
  audienceType?: AudienceTypeCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audienceRefId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  audienceLabel?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
