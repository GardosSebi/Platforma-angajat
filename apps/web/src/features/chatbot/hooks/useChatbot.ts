import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCommunicationAnnouncementRequest,
  CreateCommunicationTemplateRequest,
  UpdateCommunicationAnnouncementRequest,
  UpdateCommunicationTemplateRequest
} from "@repo/shared-types/communications";
import type {
  CreateCommunicationPublishRightRequest,
  CreateExternalContactRequest
} from "@repo/shared-types/communication-rights";
import type { PaginationParams } from "@repo/shared-types/pagination";
import { chatbotApi } from "../api/chatbot.api";

export function useChatbotDashboard(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "dashboard"],
    queryFn: chatbotApi.dashboard,
    enabled
  });
}

export function useAnnouncements(params?: PaginationParams) {
  return useQuery({
    queryKey: ["chatbot", "announcements", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => chatbotApi.listAnnouncements(params)
  });
}

export function useAnnouncement(id: string, enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "announcement", id],
    queryFn: () => chatbotApi.getAnnouncement(id),
    enabled: enabled && Boolean(id)
  });
}

export function useCommunicationTemplates() {
  return useQuery({
    queryKey: ["chatbot", "templates"],
    queryFn: chatbotApi.listTemplates
  });
}

export function useCommunicationReminders() {
  return useQuery({
    queryKey: ["chatbot", "reminders"],
    queryFn: chatbotApi.reminders
  });
}

export function useCommunicationCalendar(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "calendar"],
    queryFn: chatbotApi.calendar,
    enabled
  });
}

export function useUsageSummary(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "usage"],
    queryFn: () => chatbotApi.usageSummary(),
    enabled
  });
}

function useRefreshChatbot() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["chatbot", "dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "announcements"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "announcement"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "announcement-answers"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "reminders"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "templates"] })
    ]);
  };
}

export function useCreateAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (payload: CreateCommunicationAnnouncementRequest) => chatbotApi.createAnnouncement(payload),
    onSuccess: refresh
  });
}

export function useUpdateAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCommunicationAnnouncementRequest }) =>
      chatbotApi.updateAnnouncement(id, payload),
    onSuccess: refresh
  });
}

export function usePublishAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.publishAnnouncement(id),
    onSuccess: refresh
  });
}

export function useRetractAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.retractAnnouncement(id),
    onSuccess: refresh
  });
}

export function useDuplicateAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.duplicateAnnouncement(id),
    onSuccess: refresh
  });
}

export function useDeleteAnnouncement() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.deleteAnnouncement(id),
    onSuccess: refresh
  });
}

export function useDispatchCommunicationReminders() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: chatbotApi.dispatchReminders,
    onSuccess: refresh
  });
}

export function useCreateCommunicationTemplate() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (payload: CreateCommunicationTemplateRequest) => chatbotApi.createTemplate(payload),
    onSuccess: refresh
  });
}

export function useUpdateCommunicationTemplate() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCommunicationTemplateRequest }) =>
      chatbotApi.updateTemplate(id, payload),
    onSuccess: refresh
  });
}

export function useDeleteCommunicationTemplate() {
  const refresh = useRefreshChatbot();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.deleteTemplate(id),
    onSuccess: refresh
  });
}

export function usePublishRights(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "publish-rights"],
    queryFn: chatbotApi.listPublishRights,
    enabled
  });
}

export function useCreatePublishRight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommunicationPublishRightRequest) => chatbotApi.createPublishRight(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chatbot", "publish-rights"] });
    }
  });
}

export function useDeletePublishRight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.deletePublishRight(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chatbot", "publish-rights"] });
    }
  });
}

export function useMyCommunicationRights(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "my-rights"],
    queryFn: chatbotApi.myCommunicationRights,
    enabled
  });
}

export function useExternalContacts(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "external-contacts"],
    queryFn: chatbotApi.listExternalContacts,
    enabled
  });
}

export function useCreateExternalContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExternalContactRequest) => chatbotApi.createExternalContact(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["chatbot", "external-contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["chatbot", "chat-channels"] })
      ]);
    }
  });
}

export function useDeactivateExternalContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.deactivateExternalContact(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["chatbot", "external-contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["chatbot", "chat-channels"] })
      ]);
    }
  });
}

export function useChatChannels(enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "chat-channels"],
    queryFn: chatbotApi.listChatChannels,
    enabled
  });
}

export function useChatMessages(channelId: string, enabled = true) {
  return useQuery({
    queryKey: ["chatbot", "chat-messages", channelId],
    queryFn: () => chatbotApi.listChatMessages(channelId),
    enabled: enabled && Boolean(channelId),
    refetchInterval: 8000
  });
}

export function usePostChatMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => chatbotApi.postChatMessage(channelId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chatbot", "chat-messages", channelId] });
    }
  });
}
