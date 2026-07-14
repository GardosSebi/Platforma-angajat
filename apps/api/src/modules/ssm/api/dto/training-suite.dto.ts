import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

const SSM_TRAINING_CATEGORIES = [
  "INTRODUCTORY_GENERAL",
  "WORKPLACE",
  "PERIODIC",
  "SUPPLEMENTARY",
  "EMERGENCY_PSI"
] as const;
type SsmTrainingCategoryCode = (typeof SSM_TRAINING_CATEGORIES)[number];

export class CreateTrainingTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(SSM_TRAINING_CATEGORIES)
  category?: SsmTrainingCategoryCode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  legalMinDurationHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

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

  @IsOptional()
  @IsArray()
  testQuestions?: Array<{
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
  }>;
}

export class MaterialCompleteDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class CreateTrainingPlanDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;

  @IsString()
  @MinLength(2)
  trainingTypeId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  materialTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;
}

export class CreateTrainingPlanGroupDto {
  @IsString()
  @MinLength(2)
  employeeGroupId!: string;

  @IsString()
  @MinLength(2)
  trainingTypeId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  materialTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;
}

export class CompleteTestDto {
  @IsString()
  @MinLength(2)
  trainingPlanId!: string;

  @IsObject()
  answers!: Record<string, number>;

  @IsInt()
  @Min(0)
  durationSeconds!: number;
}

export class SignPlanDto {
  @IsString()
  role!: "EMPLOYEE" | "MANAGER" | "RESPONSIBLE";

  @IsString()
  @MinLength(5)
  signatureData!: string;
}

export class SignPlansBatchDto {
  @IsArray()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  planIds!: string[];

  @IsString()
  role!: "EMPLOYEE" | "MANAGER" | "RESPONSIBLE";

  @IsString()
  @MinLength(5)
  signatureData!: string;
}

export class GenerateCollectiveSheetDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsArray()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  attendees!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  trainerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;
}
