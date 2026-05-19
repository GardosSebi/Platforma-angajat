import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateHelpdeskTicketRequest, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { ticketingApi, TicketFilters } from "../api/ticketing.api";

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
