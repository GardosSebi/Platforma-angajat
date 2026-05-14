import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Trimis gol pentru a detașa de punctul de lucru */
  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
