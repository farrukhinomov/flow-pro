import { getCurrentApprovalStep } from '@/domain/requests/approval-routing'
import type { EmployeeRequest } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { FileText, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePaginatedRows } from '@/hooks/use-paginated-rows'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/flowpro/empty-state'
import { TableBodySkeletonRows } from '@/components/flowpro/loading-skeletons'
import { RowPagination } from '@/components/flowpro/row-pagination'
import { LiveRegion } from '@/components/live-region'
import {
  type RequestRow,
  getStatusLabel,
  statusStyles,
} from '../request-view-model'

export function RequestTable({
  actions = 'details',
  embedded,
  isLoading,
  onCancel,
  onReview,
  onSelectAll,
  onSelectRow,
  rows,
  selectable,
  selectedIds = [],
  showOwner,
  emptyAction,
}: {
  actions?: 'details' | 'approval' | 'mine'
  embedded?: boolean
  isLoading?: boolean
  onCancel?: (request: EmployeeRequest) => void
  onReview?: (request: EmployeeRequest) => void
  onSelectAll?: (checked: boolean) => void
  onSelectRow?: (id: string, checked: boolean) => void
  rows: RequestRow[]
  selectable?: boolean
  selectedIds?: string[]
  showOwner?: boolean
  emptyAction?: {
    label: string
    onClick: () => void
  }
}) {
  const { locale, t } = useI18n()
  const selectedVisibleCount = rows.filter((row) =>
    selectedIds.includes(row.id)
  ).length
  const allVisibleSelected =
    rows.length > 0 && selectedVisibleCount === rows.length
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < rows.length
  const columnCount = (showOwner ? 6 : 5) + (selectable ? 1 : 0)
  const pagination = usePaginatedRows(rows)
  const table = (
    <div className='min-w-0'>
      {/* Search and status filters rewrite these rows in place. */}
      <LiveRegion
        message={
          isLoading
            ? ''
            : t('common.resultsAnnouncement', { count: rows.length })
        }
      />
      <Table
        className={cn(showOwner ? 'min-w-[900px]' : 'min-w-[760px]')}
        containerClassName='max-h-[66svh] overflow-auto'
      >
        <TableHeader className='sticky top-0 z-10 bg-background'>
          <TableRow>
            {selectable && (
              <TableHead className='w-10'>
                <Checkbox
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? 'indeterminate'
                        : false
                  }
                  aria-label={t('requestsUi.selectAllVisibleRequests')}
                  onCheckedChange={(checked) => onSelectAll?.(checked === true)}
                />
              </TableHead>
            )}
            <TableHead className='w-28'>{t('requestsUi.date')}</TableHead>
            {showOwner && <TableHead>{t('requestsUi.person')}</TableHead>}
            <TableHead>{t('requestsUi.type')}</TableHead>
            <TableHead>{t('requestsUi.details')}</TableHead>
            <TableHead className='w-32'>{t('requestsUi.status')}</TableHead>
            <TableHead className='w-28 text-right'>
              {t('requestsUi.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableBodySkeletonRows columns={columnCount} rows={6} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className='p-4'>
                <EmptyState
                  className='min-h-56 border-0 bg-transparent'
                  icon={FileText}
                  title={t('requestsUi.noRequestsTitle')}
                  description={t('requestsUi.noRequestsDescription')}
                  action={emptyAction}
                />
              </TableCell>
            </TableRow>
          ) : (
            pagination.pageRows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(index % 2 === 1 && 'bg-muted/20')}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      aria-label={t('requestsUi.selectRequestRow')}
                      onCheckedChange={(checked) =>
                        onSelectRow?.(row.id, checked === true)
                      }
                    />
                  </TableCell>
                )}
                <TableCell className='font-mono text-sm text-muted-foreground'>
                  {formatLocaleDate(row.date, locale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </TableCell>
                {showOwner && (
                  <TableCell className='text-sm'>{row.owner}</TableCell>
                )}
                <TableCell className='text-sm'>{row.type}</TableCell>
                <TableCell className='max-w-[360px] text-sm whitespace-normal text-muted-foreground'>
                  {row.details}
                </TableCell>
                <TableCell>
                  <div className='space-y-1'>
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-xs capitalize',
                        statusStyles[row.status]
                      )}
                    >
                      {getStatusLabel(row.status, t)}
                    </Badge>
                    {row.status === 'submitted' &&
                      getCurrentApprovalStep(row.request.approvalFlow) && (
                        <div className='max-w-40 truncate text-[11px] text-muted-foreground'>
                          {t('requestsUi.waitingForApprover', {
                            names:
                              getCurrentApprovalStep(
                                row.request.approvalFlow
                              )?.approverNames.join(', ') ||
                              t('requestsUi.unassignedApprover'),
                          })}
                        </div>
                      )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    {actions === 'approval' ? (
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8'
                        onClick={() => onReview?.(row.request)}
                      >
                        {t('requestsUi.review')}
                      </Button>
                    ) : actions === 'mine' && row.status === 'submitted' ? (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        aria-label={t('requestsUi.cancelRequest')}
                        onClick={() => onCancel?.(row.request)}
                      >
                        <XCircle className='h-4 w-4 text-muted-foreground' />
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-8'
                        disabled
                      >
                        <Info className='h-4 w-4 text-muted-foreground' />
                        {t('requestsUi.details')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!isLoading && <RowPagination pagination={pagination} />}
    </div>
  )

  if (embedded) return table

  return (
    <Card>
      <CardContent className='p-0'>{table}</CardContent>
    </Card>
  )
}
