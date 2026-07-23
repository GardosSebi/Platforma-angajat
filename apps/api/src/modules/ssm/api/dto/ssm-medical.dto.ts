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
  MinLength
} from "class-validator";
import { SsmMedicalControlCategory, SsmMedicalControlResult } from "@prisma/client";

export class CreateMedicalControlTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(2)
  jobPositionId!: string;

  @IsEnum(SsmMedicalControlCategory)
  category!: SsmMedicalControlCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceDays?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(365, { each: true })
  reminderDays?: number[];
}

export class CreateMedicalControlDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;

  @IsString()
  @MinLength(2)
  controlTypeId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsDateString()
  performedAt?: string;

  @IsOptional()
  @IsEnum(SsmMedicalControlResult)
  result?: SsmMedicalControlResult;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string;

  @IsOptional()
  @IsDateString()
  validityUntil?: string;
}

export class UpdateMedicalControlDto {
  @IsOptional()
  @IsDateString()
  performedAt?: string;

  @IsOptional()
  @IsEnum(SsmMedicalControlResult)
  result?: SsmMedicalControlResult;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string;

  @IsOptional()
  @IsDateString()
  validityUntil?: string;
}
