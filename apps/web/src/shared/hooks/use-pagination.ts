import { useCallback, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@repo/shared-types/pagination";

export function usePagination(initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const resetPage = useCallback(() => setPage(1), []);

  const onPageSizeChange = useCallback((next: number) => {
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
