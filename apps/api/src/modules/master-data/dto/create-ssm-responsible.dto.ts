import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SsmResponsibleType } from "../../../common/prisma-enums";

export class CreateSsmResponsibleDto {
  @IsEnum(SsmResponsibleType)
  type!: SsmResponsibleType;

  @IsString()
  @MinLength(2)
  personName!: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
