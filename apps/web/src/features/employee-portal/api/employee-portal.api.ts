import type { SsmDocumentListItem } from "@repo/shared-types/ssm";
import type { PaginatedResult } from "@repo/shared-types/pagination";
import { httpClient } from "../../../shared/api/http-client";

export interface EmployeeSurveyAvailableItem {
  id: string;
  title: string;
  description: string | null;
  alreadyResponded: boolean;
}

export const employeePortalApi = {
  listDocuments(params?: { page?: number; pageSize?: number; q?: string }) {
    const search = new URLSearchParams();
    search.set("status", "ACTIVE");
    if (params?.q?.trim()) search.set("q", params.q.trim());
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    const q = search.toString();
    return httpClient<PaginatedResult<SsmDocumentListItem>>(`/ssm/documents${q ? `?${q}` : ""}`);
  },
  getDocumentFileUrl(documentId: string) {
    return `/ssm/documents/${documentId}/file`;
  },
  listAvailableSurveys() {
    return httpClient<{ items: EmployeeSurveyAvailableItem[] }>("/surveys/available");
  }
};
