import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaginationParams } from "@repo/shared-types/pagination";
import type {
  CreateDepartmentPayload,
  CreateEmployeePayload,
  CreateJobPositionPayload,
  CreateWorksitePayload,
  UpdateDepartmentPayload,
  UpdateEmployeePayload,
  UpdateJobPositionPayload,
  UpdateWorksitePayload
} from "../api/master-data.api";
import { masterDataApi } from "../api/master-data.api";

type QueryEnabled = { enabled?: boolean };

export function useWorksites(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "worksites", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listWorksites(params),
    enabled: options?.enabled ?? true
  });
}

/** Pentru mapări id → nume în formulare (max 100 înregistrări). */
export function useWorksitesLookup(options?: QueryEnabled) {
  return useWorksites({ page: 1, pageSize: 100 }, options);
}

export function useDepartments(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "departments", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listDepartments(params),
    enabled: options?.enabled ?? true
  });
}

export function useDepartmentsLookup(options?: QueryEnabled) {
  return useDepartments({ page: 1, pageSize: 100 }, options);
}

export function useJobPositions(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "job-positions", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => masterDataApi.listJobPositions(params),
    enabled: options?.enabled ?? true
  });
}

export function useJobPositionsLookup(options?: QueryEnabled) {
  return useJobPositions({ page: 1, pageSize: 100 }, options);
}

export function useEmployees(params?: PaginationParams, options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "employees", params?.page ?? 1, params?.pageSize ?? 25],
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
