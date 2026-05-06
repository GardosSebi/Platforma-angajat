import { IsString, MinLength } from "class-validator";

export class ImportEmployeesDto {
  @IsString()
  @MinLength(2)
  csv!: string;
}
