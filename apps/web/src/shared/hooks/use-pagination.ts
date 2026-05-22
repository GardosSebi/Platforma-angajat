import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@repo/shared-types/pagination";
import { useAuthSession } from "../auth/use-auth-session";
import {
  getStoredPagination,
  setStoredPagination
} from "../preferences/pagination-preference";
import { getStoredPageSize, setStoredPageSize } from "../preferences/page-size-preference";

export type UsePaginationOptions = {
  /** Cheie stabilă per listă (ex. `admin.users`). Restaurează pagina și pageSize după delogare. */
  persistKey?: string;
  initialPageSize?: number;
};

export function usePagination(options?: UsePaginationOptions) {
  const persistKey = options?.persistKey;
  const initialPageSize = options?.initialPageSize ?? DEFAULT_PAGE_SIZE;
  const session = useAuthSession();
  const scopeKey = session ? `${session.tenantId}:${session.userId}` : null;
  const hydratedRef = useRef(false);

  const readStored = useCallback(() => {
    if (persistKey) {
      return getStoredPagination(persistKey, initialPageSize);
    }
    return { page: 1, pageSize: getStoredPageSize(initialPageSize) };
  }, [persistKey, initialPageSize]);

  const [page, setPageState] = useState(() => readStored().page);
  const [pageSize, setPageSizeState] = useState(() => readStored().pageSize);

  useEffect(() => {
    hydratedRef.current = false;
    const stored = readStored();
    setPageState(stored.page);
    setPageSizeState(stored.pageSize);
    hydratedRef.current = true;
  }, [scopeKey, readStored]);

  useEffect(() => {
    if (!hydratedRef.current || !session) return;
    if (persistKey) {
      setStoredPagination(persistKey, page, pageSize);
    } else {
      setStoredPageSize(pageSize);
    }
  }, [page, pageSize, session, persistKey]);

  const setPage = useCallback((next: number) => {
    const safe = Number.isFinite(next) && next >= 1 ? Math.floor(next) : 1;
    setPageState(safe);
  }, []);

  const resetPage = useCallback(() => setPage(1), [setPage]);

  const onPageSizeChange = useCallback((next: number) => {
    setPageSizeState(next);
    setPage(1);
  }, [setPage]);

  return {
    page,
    pageSize,
    setPage,
    setPageSize: onPageSizeChange,
    resetPage,
    params: { page, pageSize }
  };
}
