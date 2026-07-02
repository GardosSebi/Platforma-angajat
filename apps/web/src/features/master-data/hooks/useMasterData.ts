import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaginationParams } from "@repo/shared-types/pagination";
import type {
  CreateDepartmentPayload,
  CreateEmployeeGroupPayload,
  CreateEmployeePayload,
  CreateJobPositionPayload,
  CreateLegalEntityPayload,
  CreateSsmResponsiblePayload,
  CreateWorksitePayload,
  ListEmployeesParams,
  UpdateDepartmentPayload,
  UpdateEmployeeGroupPayload,
  UpdateEmployeePayload,
  UpdateJobPositionPayload,
  UpdatePlacementPayload,
  UpdateSsmResponsiblePayload,
  UpdateWorksitePayload
} from "../api/master-data.api";
import { masterDataApi } from "../api/master-data.api";
import {
  platformAdminApi,
  type CreateTenantUserPayload
} from "../../platform-admin/api/platform-admin.api";

type QueryEnabled = { enabled?: boolean };

/** API `PaginationQueryDto` allows max 100 (`MAX_PAGE_SIZE`). */
const MASTER_DATA_LOOKUP_PAGE_SIZE = 100;

export function useWorksites(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "worksites", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listWorksites(params),
    enabled: options?.enabled ?? true
  });
}

/** Pentru mapări id → nume în formulare (max 100 înregistrări). */
export function useWorksitesLookup(options?: QueryEnabled) {
  return useWorksites({ page: 1, pageSize: MASTER_DATA_LOOKUP_PAGE_SIZE }, options);
}

export function useDepartments(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "departments", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listDepartments(params),
    enabled: options?.enabled ?? true
  });
}

export function useDepartmentsLookup(options?: QueryEnabled) {
  return useDepartments({ page: 1, pageSize: MASTER_DATA_LOOKUP_PAGE_SIZE }, options);
}

export function useJobPositions(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "job-positions", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listJobPositions(params),
    enabled: options?.enabled ?? true
  });
}

export function useJobPositionsLookup(options?: QueryEnabled) {
  return useJobPositions({ page: 1, pageSize: MASTER_DATA_LOOKUP_PAGE_SIZE }, options);
}

export function useLegalEntitiesLookup(options?: QueryEnabled) {
  return useLegalEntities({ page: 1, pageSize: MASTER_DATA_LOOKUP_PAGE_SIZE }, options);
}

export function useEmployees(params?: ListEmployeesParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: [
      "master-data",
      "employees",
      params?.page ?? 1,
      params?.pageSize ?? 25,
      params?.search ?? "",
      params?.active,
      params?.worksiteId ?? "",
      params?.departmentId ?? "",
      params?.jobPositionId ?? ""
    ],
    queryFn: () => masterDataApi.listEmployees(params),
    enabled: options?.enabled ?? true
  });
}

export function useEmployeeOptions(search?: string, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "employees", "options", search ?? ""],
    queryFn: () => masterDataApi.listEmployeeOptions(search),
    enabled: options?.enabled ?? true,
    staleTime: 60_000
  });
}

export function useEmployee(employeeId: string | undefined, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "employees", employeeId],
    queryFn: () => masterDataApi.getEmployee(employeeId!),
    enabled: (options?.enabled ?? true) && Boolean(employeeId),
    staleTime: 30_000
  });
}

export function useCreateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLegalEntityPayload) => masterDataApi.createLegalEntity(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["master-data", "legal-entities"] }),
        queryClient.invalidateQueries({ queryKey: ["master-data", "worksites"] })
      ]);
    }
  });
}

export function useLegalEntities(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "legal-entities", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listLegalEntities(params),
    enabled: options?.enabled ?? true
  });
}

export function useCreateWorksite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorksitePayload) => masterDataApi.createWorksite(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "worksites"] });
    }
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => masterDataApi.createDepartment(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["master-data", "departments"] }),
        queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] })
      ]);
    }
  });
}

export function useCreateJobPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateJobPositionPayload) => masterDataApi.createJobPosition(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["master-data", "job-positions"] }),
        queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] })
      ]);
    }
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => masterDataApi.createEmployee(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
    }
  });
}

export function useCreateTenantUserFromMasterData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantUserPayload) => platformAdminApi.createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
    }
  });
}

export function usePatchTenantUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      platformAdminApi.patchUser(userId, { roles }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
    }
  });
}

export function useUpdateWorksite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorksitePayload }) =>
      masterDataApi.updateWorksite(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data"] });
    }
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDepartmentPayload }) =>
      masterDataApi.updateDepartment(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data"] });
    }
  });
}

export function useUpdateJobPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateJobPositionPayload }) =>
      masterDataApi.updateJobPosition(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data"] });
    }
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeePayload }) =>
      masterDataApi.updateEmployee(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data"] });
    }
  });
}

export function useUpdateEmployeePlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePlacementPayload }) =>
      masterDataApi.updateEmployeePlacement(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data"] });
    }
  });
}

export function useGroups(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "groups", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listGroups(params),
    enabled: options?.enabled ?? true
  });
}

export function useGroup(groupId: string | undefined, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "groups", groupId],
    queryFn: () => masterDataApi.getGroup(groupId!),
    enabled: (options?.enabled ?? true) && Boolean(groupId),
    staleTime: 15_000
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeeGroupPayload) => masterDataApi.createGroup(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "groups"] });
    }
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeeGroupPayload }) =>
      masterDataApi.updateGroup(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "groups"] });
    }
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, employeeId }: { groupId: string; employeeId: string }) =>
      masterDataApi.addGroupMember(groupId, employeeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "groups"] });
    }
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, employeeId }: { groupId: string; employeeId: string }) =>
      masterDataApi.removeGroupMember(groupId, employeeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "groups"] });
    }
  });
}

export function useSsmResponsibles(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "ssm-responsibles", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listSsmResponsibles(params),
    enabled: options?.enabled ?? true
  });
}

export function useCreateSsmResponsible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmResponsiblePayload) => masterDataApi.createSsmResponsible(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "ssm-responsibles"] });
    }
  });
}

export function useUpdateSsmResponsible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSsmResponsiblePayload }) =>
      masterDataApi.updateSsmResponsible(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "ssm-responsibles"] });
    }
  });
}

export function useImportEmployeesCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => masterDataApi.importEmployeesCsv(csv),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
    }
  });
}
