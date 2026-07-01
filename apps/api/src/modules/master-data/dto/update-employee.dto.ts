import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { EmployeeEmploymentType } from "@prisma/client";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  cnp?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  jobPositionId?: string;

  @IsOptional()
  hireDate?: string;

  @IsOptional()
  leaveDate?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(EmployeeEmploymentType)
  employmentType?: EmployeeEmploymentType;

  @IsOptional()
  absenceStartedAt?: string;
}
