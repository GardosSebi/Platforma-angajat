import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmPsiEquipmentRequest,
  CreateSsmPsiResponsibleRequest,
  CreateSsmPsiTrainingRecordRequest,
  RegisterSsmPsiEquipmentVerificationRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function usePsiDocumentation() {
  return useQuery({
    queryKey: ["ssm", "psi", "documentation"],
    queryFn: ssmApi.psiDocumentation
  });
}

export function usePsiEquipment() {
  return useQuery({
    queryKey: ["ssm", "psi", "equipment"],
    queryFn: ssmApi.psiEquipment
  });
}

export function usePsiEquipmentNotifications() {
  return useQuery({
    queryKey: ["ssm", "psi", "equipment-notifications"],
    queryFn: ssmApi.psiEquipmentNotifications
  });
}

export function usePsiTrainings() {
  return useQuery({
    queryKey: ["ssm", "psi", "trainings"],
    queryFn: ssmApi.psiTrainings
  });
}

export function usePsiResponsibles() {
  return useQuery({
    queryKey: ["ssm", "psi", "responsibles"],
    queryFn: ssmApi.psiResponsibles
  });
}

export function useCreatePsiEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPsiEquipmentRequest) => ssmApi.createPsiEquipment(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "equipment"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "equipment-notifications"] })
      ]);
    }
  });
}

export function useRegisterPsiEquipmentVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterSsmPsiEquipmentVerificationRequest) => ssmApi.registerPsiEquipmentVerification(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "equipment"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "equipment-notifications"] })
      ]);
    }
  });
}

export function useCreatePsiTraining() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPsiTrainingRecordRequest) => ssmApi.createPsiTraining(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "trainings"] });
    }
  });
}

export function useCreatePsiResponsible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPsiResponsibleRequest) => ssmApi.createPsiResponsible(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "psi", "responsibles"] });
    }
  });
}
