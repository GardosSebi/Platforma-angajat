import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { SsmRiskAssessmentStatus, SsmRiskTargetType } from "@prisma/client";

export class SsmRiskFactorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  probability!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  severity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class SsmRiskMeasureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  owner?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSsmRiskAssessmentDto {
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

  @IsInt()
  @Min(1)
  @Max(25)
  riskLevel!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  updateReason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsmRiskFactorDto)
  factors!: SsmRiskFactorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsmRiskMeasureDto)
  measures!: SsmRiskMeasureDto[];

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class AddSsmRiskAssessmentVersionDto {
  @IsInt()
  @Min(1)
  @Max(25)
  riskLevel!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  updateReason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsmRiskFactorDto)
  factors!: SsmRiskFactorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsmRiskMeasureDto)
  measures!: SsmRiskMeasureDto[];

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class ListSsmRiskAssessmentsDto {
  @IsOptional()
  @IsEnum(SsmRiskTargetType)
  targetType?: SsmRiskTargetType;

  @IsOptional()
  @IsEnum(SsmRiskAssessmentStatus)
  status?: SsmRiskAssessmentStatus;
}
