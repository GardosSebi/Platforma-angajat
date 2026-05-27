import type { InAppNotificationsResponse } from "@repo/shared-types/notifications";
import { httpClient } from "./http-client";

export const notificationsApi = {
  list(unreadOnly = false) {
    return httpClient<InAppNotificationsResponse>(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`);
  },
  unreadCount() {
    return httpClient<{ unreadCount: number }>("/notifications/unread-count");
  },
  markRead(id: string) {
    return httpClient<{ updated: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });
  },
  markAllRead() {
    return httpClient<{ updated: number }>("/notifications/read-all", { method: "POST" });
  }
};
