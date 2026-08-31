import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { SsmGateVisitorKind } from "../../../../common/prisma-enums";

export class GateVisitAttendeeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  employeeId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idDocument?: string;

  @IsOptional()
  @IsEnum(SsmGateVisitorKind)
  visitorKind?: SsmGateVisitorKind;
}

export class CreateGateVisitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  worksiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  trainerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  trainerFunction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(400)
  briefingTitle!: string;

  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GateVisitAttendeeDto)
  attendees!: GateVisitAttendeeDto[];
}

export class BriefGateVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  briefingNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeIds?: string[];
}

export class GateVisitSignatureDto {
  @IsString()
  @MinLength(2)
  attendeeId!: string;

  @IsString()
  @MinLength(5)
  signatureData!: string;
}

export class SignGateVisitDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  trainerSignature?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GateVisitSignatureDto)
  signatures!: GateVisitSignatureDto[];
}
