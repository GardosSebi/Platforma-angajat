import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmEvacuationDrillRequest,
  CreateSsmPreventionMeasureRequest,
  CreateSsmPreventionPlanRequest,
  UpdateSsmPreventionMeasureRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function usePreventionPlans() {
  return useQuery({
    queryKey: ["ssm", "prevention-plans"],
    queryFn: ssmApi.listPreventionPlans
  });
}

export function useCreatePreventionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPreventionPlanRequest) => ssmApi.createPreventionPlan(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "risk-assessments"] })
      ]);
    }
  });
}

export function useArchivePreventionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => ssmApi.archivePreventionPlan(planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] });
    }
  });
}

export function usePreventionPlanHistory(planId?: string | null) {
  return useQuery({
    queryKey: ["ssm", "prevention-plans", planId, "history"],
    queryFn: () => ssmApi.getPreventionPlanHistory(planId!),
    enabled: Boolean(planId)
  });
}

export function useAddPreventionPlanVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      payload
    }: {
      planId: string;
      payload: import("@repo/shared-types/ssm").AddSsmPreventionPlanVersionRequest;
    }) => ssmApi.addPreventionPlanVersion(planId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans", variables.planId, "history"] })
      ]);
    }
  });
}

export function useCreatePreventionMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPreventionMeasureRequest) => ssmApi.createPreventionMeasure(payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans", variables.planId, "history"] })
      ]);
    }
  });
}

export function useUpdatePreventionMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ measureId, payload }: { measureId: string; payload: UpdateSsmPreventionMeasureRequest }) =>
      ssmApi.updatePreventionMeasure(measureId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] });
    }
  });
}

export function useEvacuationDrills() {
  return useQuery({
    queryKey: ["ssm", "evacuation-drills"],
    queryFn: ssmApi.listEvacuationDrills
  });
}

export function useCreateEvacuationDrill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmEvacuationDrillRequest) => ssmApi.createEvacuationDrill(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "evacuation-drills"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "overview", "calendar"] })
      ]);
    }
  });
}
