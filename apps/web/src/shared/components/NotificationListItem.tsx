import type { InAppNotificationItem } from "@repo/shared-types/notifications";

type Props = {
  item: InAppNotificationItem;
  onOpen: (item: InAppNotificationItem) => void;
  className?: string;
};

export function NotificationListItem({ item, onOpen, className }: Props) {
  return (
    <button
      type="button"
      className={`notification-bell-item${item.readAt ? "" : " unread"}${className ? ` ${className}` : ""}`}
      onClick={() => onOpen(item)}
    >
      <span className="notification-bell-item-title">{item.title}</span>
      <span className="notification-bell-item-body">{item.body}</span>
      <span className="notification-bell-item-time">{new Date(item.createdAt).toLocaleString("ro-RO")}</span>
    </button>
  );
}
