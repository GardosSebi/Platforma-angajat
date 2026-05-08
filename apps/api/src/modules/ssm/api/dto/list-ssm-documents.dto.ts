import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SsmDocumentStatus, SsmDocumentTargetType, SsmDocumentType } from "@prisma/client";

export class ListSsmDocumentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(SsmDocumentType)
  type?: SsmDocumentType;

  @IsOptional()
  @IsEnum(SsmDocumentStatus)
  status?: SsmDocumentStatus;

  @IsOptional()
  @IsEnum(SsmDocumentTargetType)
  targetType?: SsmDocumentTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobPositionName?: string;

  @IsOptional()
  @IsString()
  controlOnly?: string;
}
