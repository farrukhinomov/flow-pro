import { useCallback, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type PaginatedRows<TRow> = {
  page: number
  pageCount: number
  pageRows: TRow[]
  pageSize: number
  rangeEnd: number
  rangeStart: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  total: number
}

/**
 * Client-side pagination for a plain array of rows.
 *
 * The users table paginates through TanStack Table, but audit, requests,
 * timesheet, and team availability render arrays directly and rendered every
 * row. That is fine for a seeded workspace and painful for a real tenant —
 * especially audit, which only ever grows.
 *
 * Deliberately separate from `DataTablePagination`, which needs a
 * `Table` instance: converting four screens to TanStack Table to get paging
 * would be a much larger change than the problem warrants.
 */
/**
 * Page arithmetic, kept pure so it is testable without a renderer.
 *
 * The requested page is clamped rather than corrected through an effect:
 * filtering down to fewer pages while on a late page then shows the last page
 * instead of a blank table, and costs no extra render.
 */
export function derivePageState({
  pageSize,
  requestedPage,
  total,
}: {
  pageSize: number
  requestedPage: number
  total: number
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(requestedPage, 1), pageCount)
  const sliceStart = (page - 1) * pageSize

  return {
    page,
    pageCount,
    rangeEnd: Math.min(page * pageSize, total),
    rangeStart: total === 0 ? 0 : sliceStart + 1,
    sliceStart,
  }
}

export function usePaginatedRows<TRow>(
  rows: TRow[],
  { pageSize: initialPageSize = DEFAULT_PAGE_SIZE } = {}
): PaginatedRows<TRow> {
  const [pageSize, setStoredPageSize] = useState(initialPageSize)
  const [requestedPage, setRequestedPage] = useState(1)

  const total = rows.length
  const { page, pageCount, rangeEnd, rangeStart, sliceStart } = derivePageState(
    {
      pageSize,
      requestedPage,
      total,
    }
  )

  const pageRows = useMemo(
    () => rows.slice(sliceStart, sliceStart + pageSize),
    [pageSize, rows, sliceStart]
  )

  const setPageSize = useCallback((nextPageSize: number) => {
    setStoredPageSize(nextPageSize)
    // Row N moves to a different page when the size changes, so returning to
    // the first page is the predictable behaviour.
    setRequestedPage(1)
  }, [])

  return {
    page,
    pageCount,
    pageRows,
    pageSize,
    rangeEnd,
    rangeStart,
    setPage: setRequestedPage,
    setPageSize,
    total,
  }
}
