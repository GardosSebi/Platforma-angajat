import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentCorrectiveMeasureRequest,
  CreateSsmAccidentTaskRequest,
  SsmAccidentAttachmentKind
} from "@repo/shared-types/ssm";
import type { PaginationParams } from "@repo/shared-types/pagination";
import { ssmApi } from "../api/ssm.api";

export function useAccidentCases(params?: PaginationParams) {
  return useQuery({
    queryKey: ["ssm", "accidents", "cases", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => ssmApi.listAccidentCases(params)
  });
}

export function useAccidentStats(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["ssm", "accidents", "stats", params?.from ?? "", params?.to ?? ""],
    queryFn: () => ssmApi.accidentStats(params)
  });
}

function invalidateAccidentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "stats"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "attachments"] })
  ]);
}

export function useCreateAccidentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentCaseRequest) => ssmApi.createAccidentCase(payload),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useAddAccidentTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentTaskRequest) => ssmApi.addAccidentTask(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] });
    }
  });
}

export function useCompleteAccidentTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => ssmApi.completeAccidentTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "accidents", "cases"] });
    }
  });
}

export function useAddAccidentCorrectiveMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmAccidentCorrectiveMeasureRequest) => ssmApi.addAccidentCorrectiveMeasure(payload),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useCompleteAccidentCorrectiveMeasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (measureId: string) => ssmApi.completeAccidentCorrectiveMeasure(measureId),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useCloseAccidentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      payload
    }: {
      caseId: string;
      payload: CloseSsmAccidentCaseRequest;
    }) => ssmApi.closeAccidentCase(caseId, payload),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useAccidentAttachments(caseId: string) {
  return useQuery({
    queryKey: ["ssm", "accidents", "attachments", caseId],
    queryFn: () => ssmApi.listAccidentAttachments(caseId),
    enabled: Boolean(caseId)
  });
}

export function useUploadAccidentAttachment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { kind: SsmAccidentAttachmentKind; notes?: string; file: File }) =>
      ssmApi.uploadAccidentAttachment(caseId, { kind: payload.kind, notes: payload.notes }, payload.file),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}

export function useDeleteAccidentAttachment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => ssmApi.deleteAccidentAttachment(caseId, attachmentId),
    onSuccess: async () => {
      await invalidateAccidentQueries(queryClient);
    }
  });
}
