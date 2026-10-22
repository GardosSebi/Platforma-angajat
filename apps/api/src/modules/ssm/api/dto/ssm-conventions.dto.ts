import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { SsmConventionStatus } from "@prisma/client";

export class ListSsmConventionsDto {
  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsEnum(SsmConventionStatus)
  status?: SsmConventionStatus;
}

export class CreateSsmConventionPartyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cui?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  representativeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  representativeFunction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ssmContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ssmContactPhone?: string;

  @IsOptional()
  @IsEmail()
  ssmContactEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  workersCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  obligations?: string;
}

export class UpdateSsmConventionPartyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cui?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  representativeFunction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ssmContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ssmContactPhone?: string;

  @IsOptional()
  @IsEmail()
  ssmContactEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  workersCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  obligations?: string;
}

class SsmConventionClausesDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  activityDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  sharedRisks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  preventionMeasures?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  emergencyArrangements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  trainingArrangements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  eipArrangements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  coordinatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  coordinatorFunction?: string;

  @IsOptional()
  @IsEmail()
  coordinatorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateSsmConventionDto extends SsmConventionClausesDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  number?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSsmConventionPartyDto)
  parties?: CreateSsmConventionPartyDto[];
}

export class UpdateSsmConventionDto extends SsmConventionClausesDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class SignSsmConventionPartyDto {
  @IsString()
  @MinLength(20)
  signature!: string;
}

export class TerminateSsmConventionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
