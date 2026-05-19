import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../pagination";

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export type ResolvedPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function resolvePagination(query?: PaginationQueryDto): ResolvedPagination {
  const page = Math.max(1, query?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query?.pageSize ?? DEFAULT_PAGE_SIZE));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}
