import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SsmPreventionMeasureStatus, SsmPreventionPlanStatus, SsmRiskTargetType } from "@prisma/client";

export class CreateSsmPreventionPlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsEnum(SsmRiskTargetType)
  targetType!: SsmRiskTargetType;

  @IsOptional()
  @IsString()
  jobPositionId?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateSsmPreventionMeasureDto {
  @IsString()
  @MinLength(2)
  planId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsiblePerson?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSsmPreventionMeasureDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsiblePerson?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(SsmPreventionMeasureStatus)
  status?: SsmPreventionMeasureStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListSsmPreventionPlansDto {
  @IsOptional()
  @IsEnum(SsmRiskTargetType)
  targetType?: SsmRiskTargetType;

  @IsOptional()
  @IsEnum(SsmPreventionPlanStatus)
  status?: SsmPreventionPlanStatus;
}

export class CreateSsmEvacuationDrillDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsDateString()
  conductedAt!: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  participantsCount?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  result!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
