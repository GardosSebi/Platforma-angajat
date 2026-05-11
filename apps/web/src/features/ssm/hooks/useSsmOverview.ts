import { useQuery } from "@tanstack/react-query";
import type { SsmReportType } from "@repo/shared-types/ssm";
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
