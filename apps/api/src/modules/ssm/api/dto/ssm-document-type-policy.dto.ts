import { IsArray, IsOptional, IsString } from "class-validator";

export class UpsertSsmDocumentTypePolicyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  viewRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approveRoles?: string[];

  @IsOptional()
  @IsString()
  relatedModuleHint?: string | null;
}
