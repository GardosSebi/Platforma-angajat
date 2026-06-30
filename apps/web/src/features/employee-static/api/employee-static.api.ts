import type { EmployeeDirectoryResponse, EmployeeMyContextResponse, EmployeeStaticPageListItem } from "@repo/shared-types";
import { httpClient } from "../../../shared/api/http-client";

export const employeeStaticApi = {
  getMyContext() {
    return httpClient<EmployeeMyContextResponse>("/platform/employee-static/my-context");
  },
  getDirectory() {
    return httpClient<EmployeeDirectoryResponse>("/platform/employee-static/directory");
  },
  listPages(worksiteId?: string, groupIds?: string[]) {
    const params = new URLSearchParams();
    if (worksiteId) params.set("worksiteId", worksiteId);
    if (groupIds?.length) params.set("groupIds", groupIds.join(","));
    const q = params.toString();
    return httpClient<EmployeeStaticPageListItem[]>(`/platform/employee-static/pages${q ? `?${q}` : ""}`);
  },
  getPage(slug: string, worksiteId?: string, groupIds?: string[]) {
    const params = new URLSearchParams();
    if (worksiteId) params.set("worksiteId", worksiteId);
    if (groupIds?.length) params.set("groupIds", groupIds.join(","));
    const q = params.toString();
    return httpClient<{ slug: string; title: string; bodyMarkdown: string; attachmentName?: string | null }>(
      `/platform/employee-static/pages/${slug}${q ? `?${q}` : ""}`
    );
  }
};
