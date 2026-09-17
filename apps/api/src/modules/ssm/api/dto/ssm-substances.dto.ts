import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import {
  SsmDangerousSubstanceHazard,
  SsmDangerousSubstanceStatus,
  SsmDangerousSubstanceUnit
} from "@prisma/client";

export class CreateSsmDangerousSubstanceDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  casNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unNumber?: string;

  @IsOptional()
  @IsEnum(SsmDangerousSubstanceHazard)
  hazardClass?: SsmDangerousSubstanceHazard;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  location!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsEnum(SsmDangerousSubstanceUnit)
  unit?: SsmDangerousSubstanceUnit;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  containerType?: string;

  @IsOptional()
  @IsDateString()
  sdsValidUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  responsibleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateSsmDangerousSubstanceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  tradeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  casNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unNumber?: string | null;

  @IsOptional()
  @IsEnum(SsmDangerousSubstanceHazard)
  hazardClass?: SsmDangerousSubstanceHazard;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(SsmDangerousSubstanceUnit)
  unit?: SsmDangerousSubstanceUnit;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  containerType?: string | null;

  @IsOptional()
  @IsDateString()
  sdsValidUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  responsibleName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsEnum(SsmDangerousSubstanceStatus)
  status?: SsmDangerousSubstanceStatus;
}
