import { IsEmail, IsString, MinLength } from "class-validator";

export class DsarEraseDto {
  @IsEmail()
  confirmEmail!: string;

  @IsString()
  @MinLength(6)
  confirmPhrase!: string;
}
