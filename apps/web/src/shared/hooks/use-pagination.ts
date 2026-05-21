import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@repo/shared-types/pagination";
import { useAuthSession } from "../auth/use-auth-session";
import { getStoredPageSize, setStoredPageSize } from "../preferences/page-size-preference";

export function usePagination(initialPageSize = DEFAULT_PAGE_SIZE) {
  const session = useAuthSession();
  const scopeKey = session ? `${session.tenantId}:${session.userId}` : null;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getStoredPageSize(initialPageSize));

  useEffect(() => {
    setPageSize(getStoredPageSize(initialPageSize));
    setPage(1);
  }, [scopeKey, initialPageSize]);

  const resetPage = useCallback(() => setPage(1), []);

  const onPageSizeChange = useCallback((next: number) => {
    setStoredPageSize(next);
    setPageSize(next);
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize: onPageSizeChange,
    resetPage,
    params: { page, pageSize }
  };
}
