import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEmployeeGroupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
