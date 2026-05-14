import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateJobPositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Trimis gol pentru a detașa de departament */
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  corCode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
