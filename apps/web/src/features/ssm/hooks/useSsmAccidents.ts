import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloseSsmAccidentCaseRequest, CreateSsmAccidentCaseRequest, CreateSsmAccidentTaskRequest } from "@repo/shared-types/ssm";
import type { PaginationParams } from "@repo/shared-types/pagination";
import { ssmApi } from "../api/ssm.api";

export function useAccidentCases(params?: PaginationParams) {
  return useQuery({
    queryKey: ["ssm", "accidents", "cases", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => ssmApi.listAccidentCases(params)
  });
}

export function useAccidentStats() {
  return useQuery({
    queryKey: ["ssm", "accidents", "stats"],
    queryFn: ssmApi.accidentStats
  });
}

export function useCreateAccidentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentCaseRequest) => ssmApi.createAccidentCase(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "stats"] })
      ]);
    }
  });
}

export function useAddAccidentTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentTaskRequest) => ssmApi.addAccidentTask(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] });
    }
  });
}

export function useCompleteAccidentTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => ssmApi.completeAccidentTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] });
    }
  });
}

export function useCloseAccidentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      payload
    }: {
      caseId: string;
      payload: CloseSsmAccidentCaseRequest;
    }) => ssmApi.closeAccidentCase(caseId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "stats"] })
      ]);
    }
  });
}
