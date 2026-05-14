import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useWorksites(options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "worksites"],
    queryFn: masterDataApi.listWorksites,
    enabled: options?.enabled ?? true
  });
}

export function useDepartments(options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "departments"],
    queryFn: masterDataApi.listDepartments,
    enabled: options?.enabled ?? true
  });
}

export function useJobPositions(options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "job-positions"],
    queryFn: masterDataApi.listJobPositions,
    enabled: options?.enabled ?? true
  });
}

export function useEmployees(options?: QueryEnabled) {
  return useQuery({
    queryKey: ["master-data", "employees"],
    queryFn: masterDataApi.listEmployees,
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
