import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSsmCssmCommitteeRequest,
  CreateSsmCssmMeetingRequest,
  CreateSsmCssmMemberRequest,
  UpdateSsmCssmAttendeeRequest,
  UpdateSsmCssmCommitteeRequest,
  UpdateSsmCssmMemberRequest,
  UpsertSsmCssmMinutesRequest
} from "@repo/shared-types/ssm";
import { ssmApi } from "../api/ssm.api";

function invalidateCssm(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["ssm", "cssm"] });
}

export function useCssmCommittees() {
  return useQuery({
    queryKey: ["ssm", "cssm", "committees"],
    queryFn: ssmApi.listCssmCommittees
  });
}

export function useCssmCommittee(committeeId?: string) {
  return useQuery({
    queryKey: ["ssm", "cssm", "committee", committeeId],
    queryFn: () => ssmApi.getCssmCommittee(committeeId as string),
    enabled: Boolean(committeeId)
  });
}

export function useCreateCssmCommittee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSsmCssmCommitteeRequest) => ssmApi.createCssmCommittee(payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useUpdateCssmCommittee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      committeeId,
      payload
    }: {
      committeeId: string;
      payload: UpdateSsmCssmCommitteeRequest;
    }) => ssmApi.updateCssmCommittee(committeeId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useAddCssmMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      committeeId,
      payload
    }: {
      committeeId: string;
      payload: CreateSsmCssmMemberRequest;
    }) => ssmApi.addCssmMember(committeeId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useUpdateCssmMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateSsmCssmMemberRequest }) =>
      ssmApi.updateCssmMember(memberId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useCreateCssmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      committeeId,
      payload
    }: {
      committeeId: string;
      payload: CreateSsmCssmMeetingRequest;
    }) => ssmApi.createCssmMeeting(committeeId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useConveneCssmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => ssmApi.conveneCssmMeeting(meetingId),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useHoldCssmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => ssmApi.holdCssmMeeting(meetingId),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useCancelCssmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => ssmApi.cancelCssmMeeting(meetingId),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useUpdateCssmAttendee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendeeId, payload }: { attendeeId: string; payload: UpdateSsmCssmAttendeeRequest }) =>
      ssmApi.updateCssmAttendee(attendeeId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}

export function useSaveCssmMinutes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, payload }: { meetingId: string; payload: UpsertSsmCssmMinutesRequest }) =>
      ssmApi.saveCssmMinutes(meetingId, payload),
    onSuccess: async () => {
      await invalidateCssm(queryClient);
    }
  });
}
