import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { SsmDocumentTargetType, SsmDocumentType } from "@prisma/client";

export class CreateSsmDocumentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsEnum(SsmDocumentType)
  type!: SsmDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobPositionName?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsEnum(SsmDocumentTargetType)
  targetType!: SsmDocumentTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRefId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetLabel?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isControlFolder?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  changeNote?: string;
}
