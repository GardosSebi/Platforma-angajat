import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RevertSsmDocumentDto {
  @IsString()
  @MinLength(2)
  versionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  changeNote?: string;
}
