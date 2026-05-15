import type {
  EmployeeStaticPageListItem,
  EmployeeStaticPageRow,
  TenantUserSummary,
  UsageSummaryResponse,
  UserScopedRoleRow
} from "@repo/shared-types";
import { httpClient } from "../../../shared/api/http-client";

export interface PatchUserPayload {
  roles?: string[];
  active?: boolean;
}

export interface CreateTenantUserPayload {
  email: string;
  password: string;
  fullName: string;
  roles?: string[];
  cnp?: string;
  worksiteId?: string;
  departmentId?: string;
  jobPositionId?: string;
  hireDate?: string;
}

export interface CreateScopedRolePayload {
  userId: string;
  role: string;
  scope: "WORKSITE" | "EMPLOYEE_GROUP";
  worksiteId?: string;
  employeeGroupId?: string;
}

export interface CreateStaticPagePayload {
  slug: string;
  title: string;
  bodyMarkdown: string;
  audienceType?: "ALL" | "WORKSITE" | "EMPLOYEE_GROUP";
  audienceRefId?: string | null;
  sortOrder?: number;
  published?: boolean;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
}

export type UpdateStaticPagePayload = Partial<CreateStaticPagePayload>;

export const platformAdminApi = {
  listUsers() {
    return httpClient<TenantUserSummary[]>("/admin/users");
  },
  createUser(payload: CreateTenantUserPayload) {
    return httpClient<TenantUserSummary>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  patchUser(userId: string, payload: PatchUserPayload) {
    return httpClient<TenantUserSummary>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listScopedRoles(userId: string) {
    return httpClient<UserScopedRoleRow[]>(`/admin/users/${userId}/scoped-roles`);
  },
  createScopedRole(payload: CreateScopedRolePayload) {
    return httpClient<UserScopedRoleRow>("/admin/scoped-roles", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  deleteScopedRole(id: string) {
    return httpClient<{ ok: boolean }>(`/admin/scoped-roles/${id}`, { method: "DELETE" });
  },
  listStaticPages() {
    return httpClient<EmployeeStaticPageRow[]>("/admin/static-pages");
  },
  createStaticPage(payload: CreateStaticPagePayload) {
    return httpClient<EmployeeStaticPageRow>("/admin/static-pages", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateStaticPage(id: string, payload: UpdateStaticPagePayload) {
    return httpClient<EmployeeStaticPageRow>(`/admin/static-pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  deleteStaticPage(id: string) {
    return httpClient<{ ok: boolean }>(`/admin/static-pages/${id}`, { method: "DELETE" });
  },
  usageSummary(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return httpClient<UsageSummaryResponse>(`/admin/usage/summary${suffix}`);
  }
};
