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
import { SsmEipMovementType } from "@prisma/client";

export class CreateEipTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultLifetimeDays?: number;
}

export class CreateEipNormDto {
  @IsString()
  @MinLength(2)
  jobPositionId!: string;

  @IsString()
  @MinLength(2)
  eipTypeId!: string;

  @IsInt()
  @Min(1)
  requiredQuantity!: number;

  @IsInt()
  @Min(1)
  lifetimeDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  replacementRule?: string;
}

export class CreateEipMovementDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;

  @IsString()
  @MinLength(2)
  eipTypeId!: string;

  @IsEnum(SsmEipMovementType)
  movementType!: SsmEipMovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsDateString()
  replacementDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  signatureData?: string;
}
