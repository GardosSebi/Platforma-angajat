import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SsmAccidentSeverity, SsmAccidentType } from "@prisma/client";

export class CreateAccidentCaseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  employeeId?: string;

  @IsEnum(SsmAccidentType)
  type!: SsmAccidentType;

  @IsEnum(SsmAccidentSeverity)
  severity!: SsmAccidentSeverity;

  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title!: string;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  location?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  witnesses?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  itmDaysOff?: number;

  @IsOptional()
  @IsBoolean()
  hasPermanentDisability?: boolean;

  @IsOptional()
  @IsBoolean()
  isFatality?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  legalDaysDeadline?: number;
}

export class CreateAccidentTaskDto {
  @IsString()
  @MinLength(2)
  accidentCaseId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assignedTo?: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CloseAccidentCaseDto {
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  conclusions!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  correctiveMeasures!: string;
}
