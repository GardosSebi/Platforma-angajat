import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSsmEipMovementRequest, CreateSsmEipNormRequest, CreateSsmEipTypeRequest } from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function useEipTypes() {
  return useQuery({
    queryKey: ["ssm", "eip", "types"],
    queryFn: ssmApi.listEipTypes
  });
}

export function useEipNorms() {
  return useQuery({
    queryKey: ["ssm", "eip", "norms"],
    queryFn: ssmApi.listEipNorms
  });
}

export function useEipRegister() {
  return useQuery({
    queryKey: ["ssm", "eip", "register"],
    queryFn: ssmApi.eipRegister
  });
}

export function useEipNotifications() {
  return useQuery({
    queryKey: ["ssm", "eip", "notifications"],
    queryFn: ssmApi.eipNotifications
  });
}

export function useEipStockGap() {
  return useQuery({
    queryKey: ["ssm", "eip", "stock-gap"],
    queryFn: ssmApi.eipStockGapReport
  });
}

export function useCreateEipType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmEipTypeRequest) => ssmApi.createEipType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "types"] });
    }
  });
}

export function useUpsertEipNorm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmEipNormRequest) => ssmApi.upsertEipNorm(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "norms"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "stock-gap"] })
      ]);
    }
  });
}

export function useRegisterEipMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmEipMovementRequest) => ssmApi.registerEipMovement(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "register"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "eip", "stock-gap"] })
      ]);
    }
  });
}
