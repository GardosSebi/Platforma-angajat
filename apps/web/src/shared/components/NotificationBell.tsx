import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { InAppNotificationItem } from "@repo/shared-types/notifications";
import { NotificationListItem } from "./NotificationListItem";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount
} from "../hooks/use-notifications";

const SIDEBAR_PREVIEW_LIMIT = 5;

export function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const countQuery = useUnreadNotificationCount();
  const listQuery = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = countQuery.data?.unreadCount ?? 0;
  const items = listQuery.data?.items ?? [];
  const previewItems = items.slice(0, SIDEBAR_PREVIEW_LIMIT);
  const hasMore = items.length > SIDEBAR_PREVIEW_LIMIT;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onOpenItem = (item: InAppNotificationItem) => {
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    setOpen(false);
    if (item.linkPath) {
      navigate(item.linkPath);
    }
  };

  const onViewAll = () => {
    setOpen(false);
  };

  return (
    <div className="notification-bell" ref={rootRef}>
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
            {previewItems.length === 0 ? (
              <li className="notification-bell-empty">Nu există notificări.</li>
            ) : (
              previewItems.map((item) => (
                <li key={item.id}>
                  <NotificationListItem item={item} onOpen={onOpenItem} />
                </li>
              ))
            )}
          </ul>
          <div className="notification-bell-panel-foot">
            {hasMore ? (
              <p className="notification-bell-panel-hint">
                Afișate {SIDEBAR_PREVIEW_LIMIT} din {items.length} notificări recente.
              </p>
            ) : null}
            <Link to="/notificari" className="notification-bell-view-all" onClick={onViewAll}>
              Vezi toate notificările
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
