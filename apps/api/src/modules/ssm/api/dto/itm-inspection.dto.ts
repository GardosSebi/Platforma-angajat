import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateItmInspectionVisitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  worksiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CloseItmInspectionVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
