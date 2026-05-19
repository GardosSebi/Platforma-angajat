import type { PaginatedResult } from "@repo/shared-types/pagination";

type PaginationBarProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled
}: PaginationBarProps) {
  if (total === 0) {
    return <p className="pagination-bar pagination-bar--empty">Niciun rezultat.</p>;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination-bar" role="navigation" aria-label="Paginare">
      <span className="pagination-bar-summary">
        {from}–{to} din {total}
      </span>
      <div className="pagination-bar-controls">
        <button
          type="button"
          className="btn-text"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Înapoi
        </button>
        <span className="pagination-bar-page">
          Pagina {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-text"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Înainte
        </button>
        {onPageSizeChange ? (
          <label className="pagination-bar-size">
            Pe pagină{" "}
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

/** Extrage meta din răspuns paginat sau folosește valori implicite. */
export function paginationFromResult<T>(
  data: PaginatedResult<T> | undefined,
  fallbackPage: number,
  fallbackPageSize: number
) {
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? fallbackPage,
    pageSize: data?.pageSize ?? fallbackPageSize,
    totalPages: data?.totalPages ?? 1
  };
}
