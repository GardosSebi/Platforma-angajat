import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmConventionPartyRequest,
  CreateSsmConventionRequest,
  SsmConventionStatus,
  UpdateSsmConventionRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

function invalidateConventions(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ssm", "conventions"] }),
    queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] })
  ]);
}

export function useConventions(filters: { worksiteId?: string; status?: SsmConventionStatus }) {
  return useQuery({
    queryKey: ["ssm", "conventions", filters],
    queryFn: () => ssmApi.listConventions(filters)
  });
}

export function useCreateConvention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmConventionRequest) => ssmApi.createConvention(payload),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useUpdateConvention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, payload }: { conventionId: string; payload: UpdateSsmConventionRequest }) =>
      ssmApi.updateConvention(conventionId, payload),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useDeleteConvention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conventionId: string) => ssmApi.deleteConvention(conventionId),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useAddConventionParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, payload }: { conventionId: string; payload: CreateSsmConventionPartyRequest }) =>
      ssmApi.addConventionParty(conventionId, payload),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useRemoveConventionParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, partyId }: { conventionId: string; partyId: string }) =>
      ssmApi.removeConventionParty(conventionId, partyId),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useSignConventionParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, partyId, signature }: { conventionId: string; partyId: string; signature: string }) =>
      ssmApi.signConventionParty(conventionId, partyId, { signature }),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useActivateConvention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conventionId: string) => ssmApi.activateConvention(conventionId),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}

export function useTerminateConvention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, reason }: { conventionId: string; reason?: string }) =>
      ssmApi.terminateConvention(conventionId, { reason }),
    onSuccess: async () => {
      await invalidateConventions(queryClient);
    }
  });
}
