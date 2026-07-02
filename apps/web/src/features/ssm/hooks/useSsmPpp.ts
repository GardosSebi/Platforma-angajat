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
      await queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] });
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

export function useCreatePreventionMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmPreventionMeasureRequest) => ssmApi.createPreventionMeasure(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "prevention-plans"] });
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
