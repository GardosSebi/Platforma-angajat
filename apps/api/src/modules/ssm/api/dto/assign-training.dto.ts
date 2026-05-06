import { IsDateString, IsString, MinLength } from "class-validator";

export class AssignTrainingDto {
  @IsString()
  @MinLength(2)
  employeeId!: string;

  @IsString()
  @MinLength(2)
  trainingCode!: string;

  @IsDateString()
  dueDate!: string;
}
