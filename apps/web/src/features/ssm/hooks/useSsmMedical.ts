import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmMedicalControlRequest,
  CreateSsmMedicalControlTypeRequest,
  UpdateSsmMedicalControlRequest
} from "@repo/shared-types/ssm";
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

function invalidateMedical(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "controls"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "reminders"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "medical", "control-types"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "training-suite", "compliance"] })
  ]);
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
      await invalidateMedical(queryClient);
    }
  });
}

export function useUpdateMedicalControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      controlId,
      payload,
      aptitudeSheet
    }: {
      controlId: string;
      payload: UpdateSsmMedicalControlRequest;
      aptitudeSheet?: File;
    }) => ssmApi.updateMedicalControl(controlId, payload, aptitudeSheet),
    onSuccess: async () => {
      await invalidateMedical(queryClient);
    }
  });
}
