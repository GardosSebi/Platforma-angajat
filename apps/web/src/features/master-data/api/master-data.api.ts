import { httpClient } from "../../../shared/api/http-client";

export interface WorksiteItem {
  id: string;
  code: string;
  name: string;
  address?: string | null;
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
  corCode?: string | null;
  description?: string | null;
  active: boolean;
}

export interface EmployeeItem {
  id: string;
  email: string;
  fullName: string;
  cnp?: string | null;
  worksiteId?: string | null;
  departmentId?: string | null;
  jobPositionId?: string | null;
  active: boolean;
}

export interface EmployeeGroupItem {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: { members: number };
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
  corCode?: string;
  description?: string;
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

export const masterDataApi = {
  listWorksites() {
    return httpClient<WorksiteItem[]>("/master-data/worksites");
  },
  createWorksite(payload: CreateWorksitePayload) {
    return httpClient<WorksiteItem>("/master-data/worksites", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listDepartments() {
    return httpClient<DepartmentItem[]>("/master-data/departments");
  },
  createDepartment(payload: CreateDepartmentPayload) {
    return httpClient<DepartmentItem>("/master-data/departments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listJobPositions() {
    return httpClient<JobPositionItem[]>("/master-data/job-positions");
  },
  createJobPosition(payload: CreateJobPositionPayload) {
    return httpClient<JobPositionItem>("/master-data/job-positions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listEmployees() {
    return httpClient<EmployeeItem[]>("/master-data/employees");
  },
  createEmployee(payload: CreateEmployeePayload) {
    return httpClient<EmployeeItem>("/master-data/employees", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listGroups() {
    return httpClient<EmployeeGroupItem[]>("/master-data/groups");
  }
};
