import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorksiteDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
