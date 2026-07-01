import { useId } from "react";
import type { PaginatedResult } from "@repo/shared-types/pagination";
import { FieldSelect } from "./FieldSelect";
import { stringOptions } from "./field-select-options";
import { PAGE_SIZE_OPTIONS } from "../preferences/page-size-preference";

type PaginationBarProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
};

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled
}: PaginationBarProps) {
  const pageSizeSelectId = useId();

  if (total === 0) {
    return <p className="pagination-bar pagination-bar--empty">Niciun rezultat.</p>;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination-bar" role="navigation" aria-label="Paginare">
      <p className="pagination-bar-summary">
        Afișează <strong>{from}–{to}</strong> din <strong>{total}</strong>
      </p>

      <div className="pagination-bar-nav" aria-label="Navigare pagini">
        <button
          type="button"
          className="btn-secondary btn-sm pagination-bar-nav-btn"
          disabled={disabled || page <= 1}
          aria-label="Pagina anterioară"
          onClick={() => onPageChange(page - 1)}
        >
          Înapoi
        </button>

        <span className="pagination-bar-page" aria-current="page">
          <span className="pagination-bar-page-label">Pagina</span>
          <span className="pagination-bar-page-current">{page}</span>
          <span className="pagination-bar-page-sep" aria-hidden="true">
            /
          </span>
          <span className="pagination-bar-page-total">{totalPages}</span>
        </span>

        <button
          type="button"
          className="btn-secondary btn-sm pagination-bar-nav-btn"
          disabled={disabled || page >= totalPages}
          aria-label="Pagina următoare"
          onClick={() => onPageChange(page + 1)}
        >
          Înainte
        </button>
      </div>

      {onPageSizeChange ? (
        <div className="pagination-bar-size">
          <label className="pagination-bar-size-label" htmlFor={pageSizeSelectId}>
            Pe pagină
          </label>
          <FieldSelect
            variant="inline"
            className="pagination-bar-size-select"
            id={pageSizeSelectId}
            value={String(pageSize)}
            disabled={disabled}
            onChange={(next) => onPageSizeChange(Number(next))}
            options={stringOptions(PAGE_SIZE_OPTIONS.map(String))}
          />
        </div>
      ) : null}
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
