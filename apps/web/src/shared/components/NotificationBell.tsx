import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount
} from "../hooks/use-notifications";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const countQuery = useUnreadNotificationCount();
  const listQuery = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = countQuery.data?.unreadCount ?? 0;
  const items = listQuery.data?.items ?? [];

  const onOpenItem = (id: string, linkPath?: string | null, readAt?: string | null) => {
    if (!readAt) {
      markRead.mutate(id);
    }
    setOpen(false);
    if (linkPath) {
      navigate(linkPath);
    }
  };

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="notification-bell-trigger"
        aria-label={`Notificări${unreadCount ? `, ${unreadCount} necitite` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="notification-bell-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="notification-bell-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className="notification-bell-panel" role="dialog" aria-label="Notificări in-app">
          <div className="notification-bell-panel-head">
            <strong>Notificări</strong>
            {unreadCount > 0 ? (
              <button type="button" className="btn-text" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                Marchează toate citite
              </button>
            ) : null}
          </div>
          <ul className="notification-bell-list">
            {items.length === 0 ? (
              <li className="notification-bell-empty">Nu există notificări.</li>
            ) : (
              items.slice(0, 20).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notification-bell-item${item.readAt ? "" : " unread"}`}
                    onClick={() => onOpenItem(item.id, item.linkPath, item.readAt)}
                  >
                    <span className="notification-bell-item-title">{item.title}</span>
                    <span className="notification-bell-item-body">{item.body}</span>
                    <span className="notification-bell-item-time">
                      {new Date(item.createdAt).toLocaleString("ro-RO")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
