import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateDepartmentPayload,
  CreateEmployeePayload,
  CreateJobPositionPayload,
  CreateWorksitePayload
} from "../api/master-data.api";
import { masterDataApi } from "../api/master-data.api";

export function useWorksites() {
  return useQuery({
    queryKey: ["master-data", "worksites"],
    queryFn: masterDataApi.listWorksites
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["master-data", "departments"],
    queryFn: masterDataApi.listDepartments
  });
}

export function useJobPositions() {
  return useQuery({
    queryKey: ["master-data", "job-positions"],
    queryFn: masterDataApi.listJobPositions
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["master-data", "employees"],
    queryFn: masterDataApi.listEmployees
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
