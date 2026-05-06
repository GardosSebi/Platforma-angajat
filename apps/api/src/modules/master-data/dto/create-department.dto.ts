import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
