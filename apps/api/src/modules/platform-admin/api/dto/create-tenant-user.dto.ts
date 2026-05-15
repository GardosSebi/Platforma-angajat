import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { SystemRole } from "../../../../common/prisma-enums";

const ROLES = Object.values(SystemRole);

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Parola trebuie să aibă cel puțin 8 caractere." })
  @MaxLength(128)
  password!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "Numele afișat este obligatoriu." })
  @MaxLength(200)
  fullName!: string;

  /** Dacă lipsește sau e gol, se folosește rolul EMPLOYEE. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ROLES, { each: true })
  roles?: SystemRole[];

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
  @IsString()
  cnp?: string;

  @IsOptional()
  @IsString()
  worksiteId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  jobPositionId?: string;

  @IsOptional()
  hireDate?: string;
}
