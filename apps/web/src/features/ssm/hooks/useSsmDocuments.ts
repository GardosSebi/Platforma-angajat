import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSsmDocumentRequest } from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

import type { PaginationParams } from "@repo/shared-types/pagination";

export interface SsmDocumentFilters extends PaginationParams {
  q?: string;
  type?: string;
  status?: string;
  targetType?: string;
  entityName?: string;
  departmentName?: string;
  jobPositionName?: string;
  periodFrom?: string;
  periodTo?: string;
  controlOnly?: boolean;
}

function toSearchParams(filters: SsmDocumentFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.entityName?.trim()) params.set("entityName", filters.entityName.trim());
  if (filters.departmentName?.trim()) params.set("departmentName", filters.departmentName.trim());
  if (filters.jobPositionName?.trim()) params.set("jobPositionName", filters.jobPositionName.trim());
  if (filters.periodFrom) params.set("periodFrom", filters.periodFrom);
  if (filters.periodTo) params.set("periodTo", filters.periodTo);
  if (filters.controlOnly) params.set("controlOnly", "true");
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  return params;
}

export function useSsmDocuments(filters: SsmDocumentFilters) {
  const params = toSearchParams(filters);
  const queryKey = ["ssm", "documents", params.toString(), filters.page ?? 1, filters.pageSize ?? 25];
  return useQuery({
    queryKey,
    queryFn: () => ssmApi.listDocuments(params)
  });
}

export function useSsmControlFolders() {
  return useQuery({
    queryKey: ["ssm", "documents", "control-folders"],
    queryFn: ssmApi.getControlFolders
  });
}

export function useSsmDocumentHistory(documentId?: string) {
  return useQuery({
    queryKey: ["ssm", "documents", "history", documentId],
    queryFn: () => ssmApi.getDocumentHistory(documentId!),
    enabled: Boolean(documentId)
  });
}

export function useSsmDocumentTypePolicies() {
  return useQuery({
    queryKey: ["ssm", "documents", "policies"],
    queryFn: ssmApi.listDocumentTypePolicies
  });
}

export function useCreateSsmDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, file }: { payload: CreateSsmDocumentRequest; file: File }) =>
      ssmApi.createDocument(payload, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] });
    }
  });
}

export function useAddSsmDocumentVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, file, changeNote }: { documentId: string; file: File; changeNote?: string }) =>
      ssmApi.addVersion(documentId, file, changeNote),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents", "history", variables.documentId] })
      ]);
    }
  });
}

export function useRevertSsmDocumentVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, versionId }: { documentId: string; versionId: string }) =>
      ssmApi.revertVersion(documentId, versionId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents", "history", variables.documentId] })
      ]);
    }
  });
}

export function useArchiveSsmDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => ssmApi.archiveDocument(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] });
    }
  });
}

export function useApproveSsmDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => ssmApi.approveDocument(documentId),
    onSuccess: async (_, documentId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents", "history", documentId] })
      ]);
    }
  });
}
