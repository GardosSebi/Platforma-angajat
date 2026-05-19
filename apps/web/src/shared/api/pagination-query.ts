import type { PaginationParams } from "@repo/shared-types/pagination";

export function buildPaginationQuery(params?: PaginationParams): string {
  if (!params?.page && !params?.pageSize) {
    return "";
  }
  const qs = new URLSearchParams();
  if (params.page) {
    qs.set("page", String(params.page));
  }
  if (params.pageSize) {
    qs.set("pageSize", String(params.pageSize));
  }
  const built = qs.toString();
  return built ? `?${built}` : "";
}
