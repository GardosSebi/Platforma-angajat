import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompleteSsmTestRequest, CreateSsmTrainingPlanRequest, CreateSsmTrainingTypeRequest } from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function useTrainingTypes() {
  return useQuery({
    queryKey: ["ssm", "training-suite", "types"],
    queryFn: ssmApi.listTrainingTypes
  });
}

export function useTrainingPlans() {
  return useQuery({
    queryKey: ["ssm", "training-suite", "plans"],
    queryFn: ssmApi.listTrainingPlans
  });
}

export function useTrainingReminders() {
  return useQuery({
    queryKey: ["ssm", "training-suite", "reminders"],
    queryFn: ssmApi.listReminders
  });
}

export function useTrainingCompliance() {
  return useQuery({
    queryKey: ["ssm", "training-suite", "compliance"],
    queryFn: ssmApi.complianceReport
  });
}

export function useCreateTrainingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmTrainingTypeRequest) => ssmApi.createTrainingType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "types"] });
    }
  });
}

export function useCreateTrainingPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmTrainingPlanRequest) => ssmApi.createTrainingPlan(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "plans"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "compliance"] })
      ]);
    }
  });
}

export function useMaterialComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => ssmApi.markMaterialCompleted(planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "plans"] });
    }
  });
}

export function useCompleteTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompleteSsmTestRequest) => ssmApi.completeTest(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "plans"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "compliance"] })
      ]);
    }
  });
}

export function useSignPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      role,
      signatureData
    }: {
      planId: string;
      role: "EMPLOYEE" | "RESPONSIBLE";
      signatureData: string;
    }) => ssmApi.signPlan(planId, role, signatureData),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "plans"] });
    }
  });
}
