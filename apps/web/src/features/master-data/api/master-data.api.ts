import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { httpClient } from "../../../shared/api/http-client";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";

export type { PaginatedResult, PaginationParams };

export interface WorksiteItem {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  legalEntityId?: string | null;
  active: boolean;
}

export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  worksiteId?: string | null;
  active: boolean;
}

export interface JobPositionItem {
  id: string;
  code: string;
  name: string;
  departmentId?: string | null;
  legalEntityId?: string | null;
  worksiteId?: string | null;
  corCode?: string | null;
  description?: string | null;
  activityDescription?: string | null;
  active: boolean;
  legalEntity?: { id: string; code: string; name: string } | null;
  worksite?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
}

export interface EmployeeItem {
  id: string;
  email: string;
  fullName: string;
  cnp?: string | null;
  worksiteId?: string | null;
  departmentId?: string | null;
  jobPositionId?: string | null;
  hireDate?: string | null;
  leaveDate?: string | null;
  active: boolean;
  worksite?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  jobPosition?: { id: string; code: string; name: string; corCode?: string | null } | null;
}

export interface PlacementHistoryItem {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeReason?: string | null;
  worksite?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  jobPosition?: { id: string; code: string; name: string; corCode?: string | null } | null;
}

export interface EmployeeLinkedUser {
  id: string;
  roles: string[];
  active: boolean;
}

export interface EmployeeDetailItem extends EmployeeItem {
  linkedUser?: EmployeeLinkedUser | null;
  placementHistory?: PlacementHistoryItem[];
}

export interface EmployeeGroupItem {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: { members: number };
}

export interface EmployeeGroupDetailItem extends EmployeeGroupItem {
  members: Array<{ id: string; fullName: string; email: string; active: boolean }>;
}

export interface CreateLegalEntityPayload {
  code: string;
  name: string;
  cui?: string;
  headquarters?: string;
  active?: boolean;
  worksiteIds: string[];
}

export interface CreateWorksitePayload {
  code: string;
  name: string;
  address?: string;
  active?: boolean;
}

export interface CreateDepartmentPayload {
  code: string;
  name: string;
  worksiteId?: string;
  active?: boolean;
}

export interface CreateJobPositionPayload {
  code: string;
  name: string;
  departmentId?: string;
  legalEntityId?: string;
  worksiteId?: string;
  corCode?: string;
  description?: string;
  activityDescription?: string;
  active?: boolean;
}

export interface CreateEmployeePayload {
  email: string;
  fullName: string;
  cnp?: string;
  worksiteId?: string;
  departmentId?: string;
  jobPositionId?: string;
  hireDate?: string;
  leaveDate?: string;
  active?: boolean;
}

export interface CreateEmployeeGroupPayload {
  name: string;
  description?: string;
  active?: boolean;
}

export interface UpdatePlacementPayload {
  worksiteId?: string | null;
  departmentId?: string | null;
  jobPositionId?: string | null;
  changeReason: string;
}

export type UpdateWorksitePayload = Partial<CreateWorksitePayload>;
export type UpdateDepartmentPayload = Partial<CreateDepartmentPayload>;
export type UpdateJobPositionPayload = Partial<CreateJobPositionPayload>;
export interface UpdateEmployeeGroupPayload {
  name?: string;
  description?: string | null;
  active?: boolean;
}

export interface UpdateEmployeePayload {
  email?: string;
  fullName?: string;
  cnp?: string;
  worksiteId?: string;
  departmentId?: string;
  jobPositionId?: string;
  hireDate?: string;
  leaveDate?: string;
  active?: boolean;
}

export interface ListEmployeesParams extends PaginationParams {
  search?: string;
  active?: boolean;
  worksiteId?: string;
  departmentId?: string;
  jobPositionId?: string;
}

export interface EmployeeOptionItem {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
}

function buildEmployeeListQuery(params?: ListEmployeesParams): string {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search?.trim()) qs.set("search", params.search.trim());
  if (params?.active !== undefined) qs.set("active", String(params.active));
  if (params?.worksiteId) qs.set("worksiteId", params.worksiteId);
  if (params?.departmentId) qs.set("departmentId", params.departmentId);
  if (params?.jobPositionId) qs.set("jobPositionId", params.jobPositionId);
  const built = qs.toString();
  return built ? `?${built}` : "";
}

export const masterDataApi = {
  listWorksites(params?: PaginationParams) {
    return httpClient<PaginatedResult<WorksiteItem>>(`/master-data/worksites${buildPaginationQuery(params)}`);
  },
  createWorksite(payload: CreateWorksitePayload) {
    return httpClient<WorksiteItem>("/master-data/worksites", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateWorksite(id: string, payload: UpdateWorksitePayload) {
    return httpClient<WorksiteItem>(`/master-data/worksites/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listDepartments(params?: PaginationParams) {
    return httpClient<PaginatedResult<DepartmentItem>>(`/master-data/departments${buildPaginationQuery(params)}`);
  },
  createDepartment(payload: CreateDepartmentPayload) {
    return httpClient<DepartmentItem>("/master-data/departments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateDepartment(id: string, payload: UpdateDepartmentPayload) {
    return httpClient<DepartmentItem>(`/master-data/departments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listJobPositions(params?: PaginationParams) {
    return httpClient<PaginatedResult<JobPositionItem>>(`/master-data/job-positions${buildPaginationQuery(params)}`);
  },
  createJobPosition(payload: CreateJobPositionPayload) {
    return httpClient<JobPositionItem>("/master-data/job-positions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateJobPosition(id: string, payload: UpdateJobPositionPayload) {
    return httpClient<JobPositionItem>(`/master-data/job-positions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listEmployees(params?: ListEmployeesParams) {
    return httpClient<PaginatedResult<EmployeeItem>>(`/master-data/employees${buildEmployeeListQuery(params)}`);
  },
  getEmployee(id: string) {
    return httpClient<EmployeeDetailItem>(`/master-data/employees/${encodeURIComponent(id)}`);
  },
  listEmployeeOptions(search?: string, limit = 100) {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set("search", search.trim());
    qs.set("limit", String(limit));
    return httpClient<{ items: EmployeeOptionItem[] }>(`/master-data/employees/options?${qs.toString()}`);
  },
  createEmployee(payload: CreateEmployeePayload) {
    return httpClient<EmployeeItem>("/master-data/employees", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateEmployee(id: string, payload: UpdateEmployeePayload) {
    return httpClient<EmployeeItem>(`/master-data/employees/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  updateEmployeePlacement(id: string, payload: UpdatePlacementPayload) {
    return httpClient<EmployeeItem>(`/master-data/employees/${encodeURIComponent(id)}/placement`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listGroups(params?: PaginationParams) {
    return httpClient<PaginatedResult<EmployeeGroupItem>>(`/master-data/groups${buildPaginationQuery(params)}`);
  },
  getGroup(id: string) {
    return httpClient<EmployeeGroupDetailItem>(`/master-data/groups/${encodeURIComponent(id)}`);
  },
  createGroup(payload: CreateEmployeeGroupPayload) {
    return httpClient<EmployeeGroupItem>("/master-data/groups", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateGroup(id: string, payload: UpdateEmployeeGroupPayload) {
    return httpClient<EmployeeGroupItem>(`/master-data/groups/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  addGroupMember(groupId: string, employeeId: string) {
    return httpClient<{ groupId: string; employeeId: string }>(
      `/master-data/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(employeeId)}`,
      { method: "POST" }
    );
  },
  removeGroupMember(groupId: string, employeeId: string) {
    return httpClient<{ removed: boolean }>(
      `/master-data/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(employeeId)}`,
      { method: "DELETE" }
    );
  },
  listLegalEntities(params?: PaginationParams) {
    return httpClient<PaginatedResult<import("../master-data-shared").LegalEntityItem>>(
      `/master-data/legal-entities${buildPaginationQuery(params)}`
    );
  },
  createLegalEntity(payload: CreateLegalEntityPayload) {
    return httpClient<import("../master-data-shared").LegalEntityItem>("/master-data/legal-entities", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
