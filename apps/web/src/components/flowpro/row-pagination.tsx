import { useI18n } from '@/i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE_OPTIONS,
  type PaginatedRows,
} from '@/hooks/use-paginated-rows'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Pagination control for screens that render a plain array rather than a
 * TanStack `Table`. Pairs with {@link usePaginatedRows}.
 *
 * Hidden entirely when everything fits on one page, so small workspaces do not
 * gain a control that never does anything.
 */
export function RowPagination<TRow>({
  className,
  pagination,
}: {
  className?: string
  pagination: PaginatedRows<TRow>
}) {
  const { t } = useI18n()
  const { page, pageCount, pageSize, rangeEnd, rangeStart, total } = pagination

  if (total <= PAGE_SIZE_OPTIONS[0]) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        {t('dataTableUi.showingRange', {
          end: rangeEnd,
          start: rangeStart,
          total,
        })}
      </p>

      <div className='flex items-center gap-2'>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => pagination.setPageSize(Number(value))}
        >
          <SelectTrigger
            className='h-8 w-[72px]'
            aria-label={t('dataTableUi.rowsPerPage')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent side='top'>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant='outline'
          size='icon'
          className='h-8 w-8'
          disabled={page <= 1}
          aria-label={t('dataTableUi.previousPage')}
          onClick={() => pagination.setPage(page - 1)}
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>

        <span className='min-w-24 text-center text-sm font-medium'>
          {t('dataTableUi.pageOf', { page, total: pageCount })}
        </span>

        <Button
          variant='outline'
          size='icon'
          className='h-8 w-8'
          disabled={page >= pageCount}
          aria-label={t('dataTableUi.nextPage')}
          onClick={() => pagination.setPage(page + 1)}
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
