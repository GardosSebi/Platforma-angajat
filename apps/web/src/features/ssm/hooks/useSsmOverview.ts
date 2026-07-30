import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SsmOverviewFilters, SsmReportFilters, SsmReportType } from "@repo/shared-types/ssm";
import type {
  CreateSsmScheduledReportRequest,
  UpdateSsmScheduledReportRequest
} from "@repo/shared-types/ssm-scheduled-reports";
import { ssmApi } from "../api/ssm.api";

function overviewKey(filters?: SsmOverviewFilters) {
  return {
    legalEntityId: filters?.legalEntityId ?? "",
    worksiteId: filters?.worksiteId ?? "",
    departmentId: filters?.departmentId ?? "",
    employeeId: filters?.employeeId ?? "",
    source: filters?.source ?? "",
    from: filters?.from ?? "",
    to: filters?.to ?? ""
  };
}

function reportFiltersKey(filters?: SsmReportFilters) {
  return {
    legalEntityId: filters?.legalEntityId ?? "",
    worksiteId: filters?.worksiteId ?? "",
    departmentId: filters?.departmentId ?? "",
    employeeId: filters?.employeeId ?? "",
    from: filters?.from ?? "",
    to: filters?.to ?? "",
    docIssue: filters?.docIssue ?? ""
  };
}

export function useUnifiedSsmCalendar(filters?: SsmOverviewFilters) {
  return useQuery({
    queryKey: ["ssm", "overview", "calendar", overviewKey(filters)],
    queryFn: () => ssmApi.unifiedCalendar(filters)
  });
}

export function useSsmComplianceDashboard(filters?: SsmOverviewFilters) {
  return useQuery({
    queryKey: [
      "ssm",
      "overview",
      "compliance-dashboard",
      {
        legalEntityId: filters?.legalEntityId ?? "",
        worksiteId: filters?.worksiteId ?? "",
        departmentId: filters?.departmentId ?? "",
        employeeId: filters?.employeeId ?? ""
      }
    ],
    queryFn: () => ssmApi.complianceDashboard(filters)
  });
}

export function useSsmReport(type: SsmReportType, filters?: SsmReportFilters) {
  return useQuery({
    queryKey: ["ssm", "reports", type, reportFiltersKey(filters)],
    queryFn: () => ssmApi.ssmReport(type, filters)
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
