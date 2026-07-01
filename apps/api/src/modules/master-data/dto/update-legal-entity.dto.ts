import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateLegalEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  cui?: string;

  @IsOptional()
  @IsString()
  headquarters?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
