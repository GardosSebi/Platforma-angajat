import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SsmPsiEquipmentCategory, SsmPsiEquipmentStatus, SsmPsiResponsibleRole } from "@prisma/client";

export class CreateSsmPsiEquipmentDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(SsmPsiEquipmentCategory)
  category!: SsmPsiEquipmentCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsInt()
  @Min(1)
  verificationIntervalDays!: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  reminderDays?: number[];

  @IsOptional()
  @IsDateString()
  lastVerifiedAt?: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSsmPsiEquipmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(SsmPsiEquipmentCategory)
  category?: SsmPsiEquipmentCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  verificationIntervalDays?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  reminderDays?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsEnum(SsmPsiEquipmentStatus)
  status?: SsmPsiEquipmentStatus;
}

export class RegisterSsmPsiEquipmentVerificationDto {
  @IsString()
  @MinLength(2)
  equipmentId!: string;

  @IsDateString()
  performedAt!: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  result!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}

export class CreateSsmPsiTrainingRecordDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  trainingTypeId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  topic!: string;

  @IsDateString()
  conductedAt!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  trainerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  responsibleName?: string;

  @IsOptional()
  @IsString()
  evidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSsmPsiResponsibleDto {
  @IsString()
  @MinLength(2)
  worksiteId!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsEnum(SsmPsiResponsibleRole)
  role!: SsmPsiResponsibleRole;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  personName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
