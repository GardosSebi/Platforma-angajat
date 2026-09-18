import type {
  AuditLogListItem,
  DsarEraseRequest,
  DsarEraseResponse,
  EmployeeStaticPageRow,
  GdprOverviewResponse,
  ItmAccessLogRow,
  TenantSsoConfigResponse,
  TenantUserSummary,
  UpsertTenantSsoConfigRequest,
  UsageSummaryResponse,
  UserScopedRoleRow
} from "@repo/shared-types";
import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";
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
  listUsers(params?: PaginationParams) {
    return httpClient<PaginatedResult<TenantUserSummary>>(`/admin/users${buildPaginationQuery(params)}`);
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
  listStaticPages(params?: PaginationParams) {
    return httpClient<PaginatedResult<EmployeeStaticPageRow>>(
      `/admin/static-pages${buildPaginationQuery(params)}`
    );
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
  },
  grantItmAccess(userId: string, expiresAt: string) {
    return httpClient<{ id: string; itmAccessExpiresAt: string | null }>("/ssm/itm/grant-access", {
      method: "POST",
      body: JSON.stringify({ userId, expiresAt })
    });
  },
  listItmAccessLogs() {
    return httpClient<ItmAccessLogRow[]>("/ssm/itm/access-logs");
  },
  gdprOverview() {
    return httpClient<GdprOverviewResponse>("/admin/gdpr/overview");
  },
  dsarExportUrl(employeeId: string) {
    return `/admin/gdpr/dsar/${encodeURIComponent(employeeId)}/export.zip`;
  },
  eraseDsar(employeeId: string, payload: DsarEraseRequest) {
    return httpClient<DsarEraseResponse>(`/admin/gdpr/dsar/${encodeURIComponent(employeeId)}/erase`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getSsoConfig() {
    return httpClient<TenantSsoConfigResponse>("/admin/sso-config");
  },
  updateSsoConfig(payload: UpsertTenantSsoConfigRequest) {
    return httpClient<TenantSsoConfigResponse>("/admin/sso-config", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  listAuditLogs(params?: PaginationParams & { module?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.module) qs.set("module", params.module);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return httpClient<PaginatedResult<AuditLogListItem>>(`/admin/audit-logs${suffix}`);
  }
};
