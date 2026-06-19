import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InAppNotificationItem } from "@repo/shared-types/notifications";
import { NotificationListItem } from "../../../shared/components/NotificationListItem";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications
} from "../../../shared/hooks/use-notifications";

type Filter = "all" | "unread";

export function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const listQuery = useNotifications(filter === "unread");
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  const onOpenItem = (item: InAppNotificationItem) => {
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    if (item.linkPath) {
      navigate(item.linkPath);
    }
  };

  return (
    <div className="page-stack notifications-page">
      <header className="page-header notifications-page-header">
        <div>
          <h1>Notificări</h1>
          <p className="page-lead">
            {unreadCount > 0
              ? `${unreadCount} notificări necitite din ${items.length} afișate.`
              : "Toate notificările sunt citite."}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="btn-secondary notifications-page-mark-all"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Marchează toate citite
          </button>
        ) : null}
      </header>

      <div className="notifications-page-filters" role="tablist" aria-label="Filtru notificări">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className={filter === "all" ? "notifications-filter active" : "notifications-filter"}
          onClick={() => setFilter("all")}
        >
          Toate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "unread"}
          className={filter === "unread" ? "notifications-filter active" : "notifications-filter"}
          onClick={() => setFilter("unread")}
        >
          Necitite{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
      </div>

      <section className="card notifications-page-list" aria-live="polite">
        {listQuery.isLoading ? <p className="text-muted">Se încarcă notificările…</p> : null}
        {listQuery.isError ? (
          <p className="feedback error" role="alert">
            {listQuery.error instanceof Error ? listQuery.error.message : "Nu s-au putut încărca notificările."}
          </p>
        ) : null}
        {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
          <p className="notifications-page-empty">
            {filter === "unread" ? "Nu ai notificări necitite." : "Nu există notificări."}
          </p>
        ) : null}
        {!listQuery.isLoading && items.length > 0 ? (
          <ul className="notifications-page-items">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationListItem item={item} onOpen={onOpenItem} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
