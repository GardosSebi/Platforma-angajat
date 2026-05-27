export interface InAppNotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  linkPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface InAppNotificationsResponse {
  items: InAppNotificationItem[];
  unreadCount: number;
}

export interface UnreadNotificationsCountResponse {
  unreadCount: number;
}
