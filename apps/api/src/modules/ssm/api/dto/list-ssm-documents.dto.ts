import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SsmDocumentStatus, SsmDocumentTargetType, SsmDocumentType } from "@prisma/client";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

export class ListSsmDocumentsDto extends PaginationQueryDto {
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
