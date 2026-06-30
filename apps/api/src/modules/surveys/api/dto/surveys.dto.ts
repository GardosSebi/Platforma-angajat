import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Allow,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "DROPDOWN",
  "MULTI_DROPDOWN",
  "SCALE",
  "TEXT",
  "LONG_TEXT",
  "MULTI_TEXT",
  "DATE",
  "BOOLEAN",
  "NUMBER",
  "RATING_NPS",
  "RANKING",
  "FILE_UPLOAD",
  "IMAGE_SELECT"
] as const;
const SURVEY_TYPES = ["ENGAGEMENT", "COMPLIANCE", "FEEDBACK", "EXIT", "PULSE", "CUSTOM"] as const;
const AUDIENCE_TYPES = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE_GROUP", "EMPLOYEE", "CUSTOM"] as const;
const SURVEY_STATUSES = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
const RULE_OPERATORS = ["EQUALS", "NOT_EQUALS", "INCLUDES", "GREATER_THAN", "LESS_THAN"] as const;

type SurveyQuestionTypeCode = (typeof QUESTION_TYPES)[number];
type SurveyTypeCode = (typeof SURVEY_TYPES)[number];
type SurveyAudienceTypeCode = (typeof AUDIENCE_TYPES)[number];
type SurveyStatusCode = (typeof SURVEY_STATUSES)[number];
type SurveyRuleOperatorCode = (typeof RULE_OPERATORS)[number];

export class SurveyQuestionOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(220)
  label!: string;
  @IsOptional()
  @IsString()
  @MaxLength(600)
  imageUrl?: string;
}

export class SurveyQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  id!: string;

  @IsIn(QUESTION_TYPES)
  type!: SurveyQuestionTypeCode;

  @IsString()
  @MinLength(3)
  @MaxLength(400)
  title!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionOptionDto)
  options?: SurveyQuestionOptionDto[];

  @IsOptional()
  @IsInt()
  min?: number;

  @IsOptional()
  @IsInt()
  max?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  multiTextCount?: number;
}

export class SurveyConditionalRuleDto {
  @IsString()
  @MinLength(1)
  questionId!: string;

  @IsIn(RULE_OPERATORS)
  operator!: SurveyRuleOperatorCode;

  @Allow()
  value!: string | number | boolean | string[] | null;

  @IsString()
  @MinLength(1)
  showQuestionId!: string;
}

export class CreateSurveyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  @IsOptional()
  @IsIn(SURVEY_TYPES)
  surveyType?: SurveyTypeCode;

  @IsOptional()
  @IsIn(AUDIENCE_TYPES)
  audienceType?: SurveyAudienceTypeCode;

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
  @IsDateString()
  closesAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questionSchema!: SurveyQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyConditionalRuleDto)
  conditionalLogic?: SurveyConditionalRuleDto[];

  @IsOptional()
  @IsBoolean()
  privateLinkEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymousMode?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifyOnPublish?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateTicket?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  autoTicketTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  autoTicketCategory?: string;

  @IsOptional()
  @IsObject()
  translations?: Record<string, { title: string; description?: string; questions?: Record<string, string> }>;
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  @IsOptional()
  @IsIn(SURVEY_STATUSES)
  status?: SurveyStatusCode;

  @IsOptional()
  @IsIn(SURVEY_TYPES)
  surveyType?: SurveyTypeCode;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsIn(AUDIENCE_TYPES)
  audienceType?: SurveyAudienceTypeCode;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questionSchema?: SurveyQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyConditionalRuleDto)
  conditionalLogic?: SurveyConditionalRuleDto[];

  @IsOptional()
  @IsBoolean()
  privateLinkEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymousMode?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifyOnPublish?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateTicket?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  autoTicketTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  autoTicketCategory?: string;

  @IsOptional()
  @IsObject()
  translations?: Record<string, { title: string; description?: string; questions?: Record<string, string> }>;
}

export class SubmitSurveyResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employeeId?: string;

  @IsObject()
  answers!: Record<string, string | number | boolean | string[] | null>;
}

export class CreatePublicLinkDto {
  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  responseLimit?: number;
}
