import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SsmReportType } from "@repo/shared-types/ssm";
import type {
  CreateSsmScheduledReportRequest,
  UpdateSsmScheduledReportRequest
} from "@repo/shared-types/ssm-scheduled-reports";
import { ssmApi } from "../api/ssm.api";

export function useUnifiedSsmCalendar() {
  return useQuery({
    queryKey: ["ssm", "overview", "calendar"],
    queryFn: ssmApi.unifiedCalendar
  });
}

export function useSsmComplianceDashboard() {
  return useQuery({
    queryKey: ["ssm", "overview", "compliance-dashboard"],
    queryFn: ssmApi.complianceDashboard
  });
}

export function useSsmReport(type: SsmReportType) {
  return useQuery({
    queryKey: ["ssm", "reports", type],
    queryFn: () => ssmApi.ssmReport(type)
  });
}

export function useScheduledReports(enabled = true) {
  return useQuery({
    queryKey: ["ssm", "scheduled-reports"],
    queryFn: ssmApi.listScheduledReports,
    enabled
  });
}

export function useCreateScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmScheduledReportRequest) => ssmApi.createScheduledReport(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "scheduled-reports"] });
    }
  });
}

export function useUpdateScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSsmScheduledReportRequest }) =>
      ssmApi.updateScheduledReport(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "scheduled-reports"] });
    }
  });
}

export function useDeleteScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ssmApi.deleteScheduledReport(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "scheduled-reports"] });
    }
  });
}
