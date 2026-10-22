import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SsmExposureSheetStatus } from "@prisma/client";

export class ListSsmExposureSheetsDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(SsmExposureSheetStatus)
  status?: SsmExposureSheetStatus;
}

export class SsmExposureCoverageQueryDto {
  @IsOptional()
  @IsString()
  jobPositionId?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;
}

export class IssueSsmExposureSheetDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;
}

export class IssueMissingSsmExposureSheetsDto {
  @IsOptional()
  @IsString()
  jobPositionId?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;
}

export class SignSsmExposureEmployeeDto {
  @IsString()
  @MinLength(20)
  signature!: string;
}

export class SignSsmExposureAssessorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  assessorName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  assessorFunction?: string;

  @IsString()
  @MinLength(20)
  signature!: string;
}
