import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdatePlacementDto {
  @IsOptional()
  @IsString()
  worksiteId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  jobPositionId?: string | null;

  @IsString()
  @MinLength(2)
  changeReason!: string;
}
