import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmDangerousSubstanceRequest,
  UpdateSsmDangerousSubstanceRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

function invalidateSubstances(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["ssm", "substances"] });
}

export function useDangerousSubstances(worksiteId?: string) {
  return useQuery({
    queryKey: ["ssm", "substances", worksiteId ?? "all"],
    queryFn: () => ssmApi.listDangerousSubstances(worksiteId)
  });
}

export function useCreateDangerousSubstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, sdsSheet }: { payload: CreateSsmDangerousSubstanceRequest; sdsSheet?: File }) =>
      ssmApi.createDangerousSubstance(payload, sdsSheet),
    onSuccess: async () => {
      await invalidateSubstances(queryClient);
    }
  });
}

export function useUpdateDangerousSubstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      sdsSheet
    }: {
      id: string;
      payload: UpdateSsmDangerousSubstanceRequest;
      sdsSheet?: File;
    }) => ssmApi.updateDangerousSubstance(id, payload, sdsSheet),
    onSuccess: async () => {
      await invalidateSubstances(queryClient);
    }
  });
}

export function useRetireDangerousSubstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ssmApi.retireDangerousSubstance(id),
    onSuccess: async () => {
      await invalidateSubstances(queryClient);
    }
  });
}
