import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SsmResponsibleType } from "../../../common/prisma-enums";

export class UpdateSsmResponsibleDto {
  @IsOptional()
  @IsEnum(SsmResponsibleType)
  type?: SsmResponsibleType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  personName?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string | null;

  @IsOptional()
  @IsString()
  legalEntityId?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
