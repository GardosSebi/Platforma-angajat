import { DEFAULT_PAGE_SIZE } from "@repo/shared-types/pagination";
import { authStore } from "../auth/auth-store";
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from "./page-size-preference";

export type StoredPagination = {
  page: number;
  pageSize: number;
};

const TENANT_KEY = "tenant_id";
const USER_ID_KEY = "auth_user_id";
const LEGACY_PAGE_SIZE_KEY = "employee-platform:pageSize";

function isValidPageSize(value: number): value is PageSizeOption {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption);
}

function paginationStorageKey(tenantId: string, userId: string, persistKey: string): string {
  return `employee-platform:pagination:${tenantId}:${userId}:${persistKey}`;
}

function legacyPageSizeKey(tenantId: string, userId: string): string {
  return `${LEGACY_PAGE_SIZE_KEY}:${tenantId}:${userId}`;
}

function sessionIds(): { tenantId: string; userId: string } | null {
  const session = authStore.get();
  if (session) {
    return { tenantId: session.tenantId, userId: session.userId };
  }
  const tenantId = localStorage.getItem(TENANT_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);
  if (tenantId && userId) {
    return { tenantId, userId };
  }
  return null;
}

function readLegacyPageSize(tenantId: string, userId: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(legacyPageSizeKey(tenantId, userId));
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && isValidPageSize(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function getStoredPagination(
  persistKey: string,
  fallbackPageSize = DEFAULT_PAGE_SIZE
): StoredPagination {
  const ids = sessionIds();
  if (!ids) {
    return { page: 1, pageSize: fallbackPageSize };
  }

  try {
    const raw = localStorage.getItem(paginationStorageKey(ids.tenantId, ids.userId, persistKey));
    if (raw) {
      const parsed = JSON.parse(raw) as { page?: unknown; pageSize?: unknown };
      const pageSize =
        typeof parsed.pageSize === "number" && isValidPageSize(parsed.pageSize)
          ? parsed.pageSize
          : readLegacyPageSize(ids.tenantId, ids.userId, fallbackPageSize);
      const page =
        typeof parsed.page === "number" && Number.isFinite(parsed.page) && parsed.page >= 1
          ? Math.floor(parsed.page)
          : 1;
      return { page, pageSize };
    }
  } catch {
    /* ignore */
  }

  return { page: 1, pageSize: readLegacyPageSize(ids.tenantId, ids.userId, fallbackPageSize) };
}

export function setStoredPagination(
  persistKey: string,
  page: number,
  pageSize: number
): void {
  if (!isValidPageSize(pageSize)) return;
  const ids = sessionIds();
  if (!ids) return;

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  try {
    localStorage.setItem(
      paginationStorageKey(ids.tenantId, ids.userId, persistKey),
      JSON.stringify({ page: safePage, pageSize })
    );
  } catch {
    /* ignore */
  }
}
