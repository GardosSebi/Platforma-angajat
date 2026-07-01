import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateEmployeeGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
