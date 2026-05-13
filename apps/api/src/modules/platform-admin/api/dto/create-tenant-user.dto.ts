import { ArrayMinSize, IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SystemRole } from "../../../../common/prisma-enums";

const ROLES = Object.values(SystemRole);

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Parola trebuie să aibă cel puțin 8 caractere." })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  /** Dacă lipsește sau e gol, se folosește rolul EMPLOYEE. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ROLES, { each: true })
  roles?: SystemRole[];
}
