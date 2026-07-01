import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateLegalEntityDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  cui?: string;

  @IsOptional()
  @IsString()
  headquarters?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  worksiteIds!: string[];
}
