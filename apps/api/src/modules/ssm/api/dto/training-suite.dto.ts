import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

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

export class CompleteTestDto {
  @IsString()
  @MinLength(2)
  trainingPlanId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsInt()
  @Min(0)
  durationSeconds!: number;

  @IsBoolean()
  passed!: boolean;
}

export class SignPlanDto {
  @IsString()
  role!: "EMPLOYEE" | "RESPONSIBLE";

  @IsString()
  @MinLength(5)
  signatureData!: string;
}
