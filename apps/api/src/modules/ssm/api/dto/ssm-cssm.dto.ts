import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SsmCssmMeetingKind, SsmCssmMemberRole } from "@prisma/client";

export class CreateSsmCssmCommitteeDto {
  @IsString()
  @MinLength(2)
  legalEntityId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  decisionNumber?: string;

  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @IsOptional()
  @IsDateString()
  constitutedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  notes?: string;
}

export class UpdateSsmCssmCommitteeDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  decisionNumber?: string;

  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @IsOptional()
  @IsDateString()
  constitutedAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  meetingIntervalMonths?: number;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  notes?: string;
}

export class SsmCssmArchiveQueryDto {
  @IsOptional()
  @IsString()
  legalEntityId?: string;
}

export class SsmCssmArchiveZipQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class CreateSsmCssmMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsEnum(SsmCssmMemberRole)
  role!: SsmCssmMemberRole;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  functionTitle?: string;

  @IsOptional()
  @IsDateString()
  appointedAt?: string;

  @IsOptional()
  @IsDateString()
  termEndsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSsmCssmMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  employeeId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsEnum(SsmCssmMemberRole)
  role?: SsmCssmMemberRole;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  functionTitle?: string;

  @IsOptional()
  @IsDateString()
  appointedAt?: string;

  @IsOptional()
  @IsDateString()
  termEndsAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSsmCssmMeetingDto {
  @IsOptional()
  @IsEnum(SsmCssmMeetingKind)
  kind?: SsmCssmMeetingKind;

  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agenda?: string;
}

export class UpdateSsmCssmMeetingDto {
  @IsOptional()
  @IsEnum(SsmCssmMeetingKind)
  kind?: SsmCssmMeetingKind;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agenda?: string;
}

export class UpsertSsmCssmMinutesDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  topics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  decisions?: string;

  @IsOptional()
  @IsDateString()
  nextMeetingAt?: string;
}

export class UpdateSsmCssmAttendeeDto {
  @IsOptional()
  @IsBoolean()
  present?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  signature?: string;
}
