import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BriefSsmGateVisitRequest,
  CreateSsmGateVisitRequest,
  SignSsmGateVisitRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function useGateVisits(worksiteId?: string) {
  return useQuery({
    queryKey: ["ssm", "gate", "visits", worksiteId ?? "all"],
    queryFn: () => ssmApi.listGateVisits(worksiteId)
  });
}

export function useAdmissionBlocks(worksiteId?: string) {
  return useQuery({
    queryKey: ["ssm", "gate", "admission-blocks", worksiteId ?? "all"],
    queryFn: () => ssmApi.listAdmissionBlocks(worksiteId)
  });
}

function invalidateGate(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "gate"] })
  ]);
}

export function useCreateGateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmGateVisitRequest) => ssmApi.createGateVisit(payload),
    onSuccess: async () => {
      await invalidateGate(queryClient);
    }
  });
}

export function useBriefGateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: BriefSsmGateVisitRequest }) =>
      ssmApi.briefGateVisit(visitId, payload),
    onSuccess: async () => {
      await invalidateGate(queryClient);
    }
  });
}

export function useSignGateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SignSsmGateVisitRequest }) =>
      ssmApi.signGateVisit(visitId, payload),
    onSuccess: async () => {
      await invalidateGate(queryClient);
    }
  });
}
