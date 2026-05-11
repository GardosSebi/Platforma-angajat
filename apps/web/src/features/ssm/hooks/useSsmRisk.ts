import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddSsmRiskAssessmentVersionRequest,
  CreateSsmRiskAssessmentRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

export function useRiskAssessments(filters: { targetType?: string; status?: string }) {
  return useQuery({
    queryKey: ["ssm", "risk-assessments", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.targetType) params.set("targetType", filters.targetType);
      if (filters.status) params.set("status", filters.status);
      return ssmApi.listRiskAssessments(params);
    }
  });
}

export function useRiskAssessmentHistory(assessmentId?: string) {
  return useQuery({
    queryKey: ["ssm", "risk-assessments", assessmentId, "history"],
    queryFn: () => ssmApi.getRiskAssessmentHistory(assessmentId as string),
    enabled: Boolean(assessmentId)
  });
}

export function useCreateRiskAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmRiskAssessmentRequest) => ssmApi.createRiskAssessment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "risk-assessments"] });
    }
  });
}

export function useAddRiskAssessmentVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, payload }: { assessmentId: string; payload: AddSsmRiskAssessmentVersionRequest }) =>
      ssmApi.addRiskAssessmentVersion(assessmentId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "risk-assessments"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "risk-assessments", variables.assessmentId, "history"] })
      ]);
    }
  });
}

export function useArchiveRiskAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) => ssmApi.archiveRiskAssessment(assessmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "risk-assessments"] });
    }
  });
}
