import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCommunicationAnnouncementRequest, CreateCommunicationTemplateRequest } from "@repo/shared-types/communications";
import { chatbotApi } from "../api/chatbot.api";

export function useChatbotDashboard() {
  return useQuery({
    queryKey: ["chatbot", "dashboard"],
    queryFn: chatbotApi.dashboard
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["chatbot", "announcements"],
    queryFn: chatbotApi.listAnnouncements
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

function useRefreshChatbot() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["chatbot", "dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["chatbot", "announcements"] }),
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
