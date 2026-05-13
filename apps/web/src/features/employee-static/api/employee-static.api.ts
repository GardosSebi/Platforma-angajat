import type { EmployeeStaticPageListItem, EmployeeStaticPageRow } from "@repo/shared-types";
import { httpClient } from "../../../shared/api/http-client";

function buildQuery(worksiteId?: string, groupIds?: string[]) {
  const q = new URLSearchParams();
  if (worksiteId) q.set("worksiteId", worksiteId);
  if (groupIds?.length) q.set("groupIds", groupIds.join(","));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return suffix;
}

export const employeeStaticApi = {
  listPages(worksiteId?: string, groupIds?: string[]) {
    return httpClient<EmployeeStaticPageListItem[]>(`/platform/employee-static/pages${buildQuery(worksiteId, groupIds)}`);
  },
  getPage(slug: string, worksiteId?: string, groupIds?: string[]) {
    return httpClient<EmployeeStaticPageRow>(
      `/platform/employee-static/pages/${encodeURIComponent(slug)}${buildQuery(worksiteId, groupIds)}`
    );
  }
};
