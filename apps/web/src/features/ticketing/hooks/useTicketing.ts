import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateHelpdeskTicketCommentRequest,
  CreateHelpdeskTicketRequest,
  HelpdeskTicketStatus
} from "@repo/shared-types/ticketing";
import { platformAdminApi } from "../../platform-admin/api/platform-admin.api";
import { ticketingApi, TicketFilters } from "../api/ticketing.api";
import type { TicketOperatorOption } from "../ticketing-shared";

export function useTicketingKanban(filters: TicketFilters) {
  const queryFilters: TicketFilters = {
    ...filters,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 100
  };
  return useQuery({
    queryKey: ["ticketing", "kanban", queryFilters],
    queryFn: () => ticketingApi.kanban(queryFilters)
  });
}

export function useTicketingStats() {
  return useQuery({
    queryKey: ["ticketing", "stats"],
    queryFn: ticketingApi.stats
  });
}

export function useTicketOperatorOptions() {
  const usersQuery = useQuery({
    queryKey: ["admin", "users", "ticket-operators"],
    queryFn: () => platformAdminApi.listUsers({ page: 1, pageSize: 200 }),
    retry: false,
    staleTime: 60_000
  });
  const statsQuery = useTicketingStats();

  return useMemo(() => {
    const byId = new Map<string, TicketOperatorOption>();

    for (const user of usersQuery.data?.items ?? []) {
      byId.set(user.id, { id: user.id, name: user.fullName?.trim() || user.email });
    }
    for (const operator of statsQuery.data?.operators ?? []) {
      if (!operator.assignedToUserId || byId.has(operator.assignedToUserId)) continue;
      byId.set(operator.assignedToUserId, {
        id: operator.assignedToUserId,
        name: operator.assignedToName?.trim() || operator.assignedToUserId
      });
    }

    return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name, "ro"));
  }, [usersQuery.data, statsQuery.data]);
}

export function useTicketComments(ticketId: string) {
  return useQuery({
    queryKey: ["ticketing", "comments", ticketId],
    queryFn: () => ticketingApi.comments(ticketId),
    enabled: Boolean(ticketId)
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  const refresh = useRefreshTicketing();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateHelpdeskTicketCommentRequest }) =>
      ticketingApi.addComment(id, payload),
    onSuccess: async (_comment, variables) => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ["ticketing", "comments", variables.id] })
      ]);
    }
  });
}

function useRefreshTicketing() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ticketing", "kanban"] }),
      queryClient.invalidateQueries({ queryKey: ["ticketing", "stats"] })
    ]);
  };
}

export function useCreateTicket() {
  const refresh = useRefreshTicketing();
  return useMutation({
    mutationFn: (payload: CreateHelpdeskTicketRequest) => ticketingApi.createTicket(payload),
    onSuccess: refresh
  });
}

export function useMoveTicket() {
  const refresh = useRefreshTicketing();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HelpdeskTicketStatus }) => ticketingApi.moveTicket(id, status),
    onSuccess: refresh
  });
}

export function useAssignTicket() {
  const refresh = useRefreshTicketing();
  return useMutation({
    mutationFn: ({ id, assignedToUserId, assignedToName }: { id: string; assignedToUserId: string; assignedToName?: string }) =>
      ticketingApi.assignTicket(id, assignedToUserId, assignedToName),
    onSuccess: refresh
  });
}
