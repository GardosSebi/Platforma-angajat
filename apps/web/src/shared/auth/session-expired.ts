import { clearUserScopedQueryCache } from "./clear-user-query-cache";
import { authStore, SESSION_EXPIRED_FLAG_KEY } from "./auth-store";

let redirecting = false;

function isPublicPath(): boolean {
  const path = window.location.pathname;
  return path === "/login" || path.startsWith("/surveys/public/");
}

/** Șterge sesiunea și redirecționează la login (idempotent). */
export function handleSessionExpired(): void {
  if (redirecting || isPublicPath()) {
    return;
  }
  redirecting = true;
  sessionStorage.setItem(SESSION_EXPIRED_FLAG_KEY, "1");
  clearUserScopedQueryCache();
  authStore.clear();
  const returnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(`/login?returnUrl=${returnUrl}&expired=1`);
}
