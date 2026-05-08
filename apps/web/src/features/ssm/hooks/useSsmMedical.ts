import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSsmMedicalControlRequest, CreateSsmMedicalControlTypeRequest } from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function useMedicalControlTypes() {
  return useQuery({
    queryKey: ["ssm", "medical", "control-types"],
    queryFn: ssmApi.listMedicalControlTypes
  });
}

export function useMedicalControls() {
  return useQuery({
    queryKey: ["ssm", "medical", "controls"],
    queryFn: ssmApi.listMedicalControls
  });
}

export function useMedicalReminders() {
  return useQuery({
    queryKey: ["ssm", "medical", "reminders"],
    queryFn: ssmApi.medicalReminders
  });
}

export function useCreateMedicalControlType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmMedicalControlTypeRequest) => ssmApi.createMedicalControlType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "control-types"] });
    }
  });
}

export function useCreateMedicalControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, aptitudeSheet }: { payload: CreateSsmMedicalControlRequest; aptitudeSheet?: File }) =>
      ssmApi.createMedicalControl(payload, aptitudeSheet),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "controls"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "compliance"] })
      ]);
    }
  });
}
