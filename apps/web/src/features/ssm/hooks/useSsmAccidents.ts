import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentCorrectiveMeasureRequest,
  CreateSsmAccidentTaskRequest
} from "@repo/shared-types/ssm";
import type { PaginationParams } from "@repo/shared-types/pagination";
import { ssmApi } from "../api/ssm.api";

export function useAccidentCases(params?: PaginationParams) {
  return useQuery({
    queryKey: ["ssm", "accidents", "cases", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => ssmApi.listAccidentCases(params)
  });
}

export function useAccidentStats(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["ssm", "accidents", "stats", params?.from ?? "", params?.to ?? ""],
    queryFn: () => ssmApi.accidentStats(params)
  });
}

function invalidateAccidentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "stats"] })
  ]);
}

export function useCreateAccidentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentCaseRequest) => ssmApi.createAccidentCase(payload),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
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

export function useAddAccidentCorrectiveMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentCorrectiveMeasureRequest) => ssmApi.addAccidentCorrectiveMeasure(payload),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useCompleteAccidentCorrectiveMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (measureId: string) => ssmApi.completeAccidentCorrectiveMeasure(measureId),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
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
      await invalidateAccidentQueries(queryClient);
    }
  });
}
