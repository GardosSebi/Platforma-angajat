import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  IssueMissingSsmExposureSheetsRequest,
  SignSsmExposureAssessorRequest,
  SsmExposureSheetStatus
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

function invalidateExposure(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "exposure"] }),
    queryClient.invalidateQueries({ queryKey: ["employee-portal", "dossier"] })
  ]);
}

export function useExposureCoverage(filters: { jobPositionId?: string; worksiteId?: string }) {
  return useQuery({
    queryKey: ["ssm", "exposure", "coverage", filters],
    queryFn: () => ssmApi.exposureCoverage(filters)
  });
}

export function useExposureSheets(params: { employeeId?: string; status?: SsmExposureSheetStatus }, enabled = true) {
  return useQuery({
    queryKey: ["ssm", "exposure", "sheets", params],
    queryFn: () => ssmApi.listExposureSheets(params),
    enabled
  });
}

export function useIssueExposureSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => ssmApi.issueExposureSheet({ employeeId }),
    onSuccess: async () => {
      await invalidateExposure(queryClient);
    }
  });
}

export function useIssueMissingExposureSheets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueMissingSsmExposureSheetsRequest) => ssmApi.issueMissingExposureSheets(payload),
    onSuccess: async () => {
      await invalidateExposure(queryClient);
    }
  });
}

export function useSignExposureAssessor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, payload }: { sheetId: string; payload: SignSsmExposureAssessorRequest }) =>
      ssmApi.signExposureAssessor(sheetId, payload),
    onSuccess: async () => {
      await invalidateExposure(queryClient);
    }
  });
}
