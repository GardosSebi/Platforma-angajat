import { DEFAULT_PAGE_SIZE } from "@repo/shared-types/pagination";
import { authStore } from "../auth/auth-store";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/** Cheie veche (globală) — citită o singură dată pentru migrare la login. */
const LEGACY_STORAGE_KEY = "employee-platform:pageSize";

function isValidPageSize(value: number): value is PageSizeOption {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption);
}

function storageKeyForSession(): string | null {
  const session = authStore.get();
  if (!session?.userId || !session.tenantId) return null;
  return `employee-platform:pageSize:${session.tenantId}:${session.userId}`;
}

function readPageSizeFromKey(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && isValidPageSize(parsed) ? parsed : null;
}

export function getStoredPageSize(fallback = DEFAULT_PAGE_SIZE): number {
  try {
    const key = storageKeyForSession();
    if (!key) return fallback;

    const stored = readPageSizeFromKey(key);
    if (stored !== null) return stored;

    const legacy = readPageSizeFromKey(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      localStorage.setItem(key, String(legacy));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return legacy;
    }
  } catch {
    /* localStorage indisponibil (mod privat etc.) */
  }
  return fallback;
}

export function setStoredPageSize(pageSize: number): void {
  if (!isValidPageSize(pageSize)) return;
  try {
    const key = storageKeyForSession();
    if (!key) return;
    localStorage.setItem(key, String(pageSize));
  } catch {
    /* ignore */
  }
}
