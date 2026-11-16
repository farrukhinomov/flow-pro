import { useState } from 'react'
import { evaluateRequestDraftPolicy } from '@/domain/requests/policy'
import type { RequestDecision } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApprovalEmployeeOption, RequestRow } from '../request-view-model'
import { RequestTable } from './request-table'

export function ApprovalQueueCard({
  employeeFilter,
  employees,
  isLoading,
  kindFilter,
  onEmployeeFilterChange,
  onKindFilterChange,
  onReview,
  onSelectAll,
  onSelectRow,
  onBatchDecision,
  allRequests,
  rows,
  selectedIds,
}: {
  employeeFilter: string
  employees: ApprovalEmployeeOption[]
  isLoading?: boolean
  kindFilter: string
  onEmployeeFilterChange: (value: string) => void
  onKindFilterChange: (value: string) => void
  onReview: (request: RequestRow['request']) => void
  onSelectAll: (checked: boolean) => void
  onSelectRow: (id: string, checked: boolean) => void
  onBatchDecision: (
    ids: string[],
    decision: RequestDecision,
    comment: string
  ) => Promise<void>
  allRequests: RequestRow['request'][]
  rows: RequestRow[]
  selectedIds: string[]
}) {
  const { t } = useI18n()
  const [batchDecision, setBatchDecision] = useState<RequestDecision | null>(
    null
  )
  const hasSelection = selectedIds.length > 0
  const riskSummary = rows.reduce(
    (acc, row) => {
      const review = evaluateRequestDraftPolicy({
        draft: row.request,
        existingRequests: allRequests.filter(
          (item) => item.id !== row.request.id
        ),
      })
      if (review.blocking.length > 0) acc.blocking += 1
      else if (review.warnings.length > 0) acc.warnings += 1
      return acc
    },
    { blocking: 0, warnings: 0 }
  )

  const decideSelected = async (decision: RequestDecision, comment: string) => {
    setBatchDecision(decision)
    try {
      await onBatchDecision(selectedIds, decision, comment)
    } finally {
      setBatchDecision(null)
    }
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <CardTitle className='text-base'>
              {t('requestsUi.approvalTitle')}
            </CardTitle>
            <CardDescription>
              {t('requestsUi.approvalSubtitle')}
            </CardDescription>
            <div className='mt-2 flex flex-wrap gap-2'>
              {riskSummary.blocking > 0 && (
                <Badge variant='outline' className='text-rose-600'>
                  {riskSummary.blocking}
                  {riskSummary.blocking === 1
                    ? ` ${t('requestsUi.policyBlock')}`
                    : ` ${t('requestsUi.policyBlocks')}`}
                </Badge>
              )}
              {riskSummary.warnings > 0 && (
                <Badge variant='outline' className='text-amber-600'>
                  {riskSummary.warnings}{' '}
                  {riskSummary.warnings === 1
                    ? t('requestsUi.warning')
                    : t('requestsUi.warnings')}
                </Badge>
              )}
            </div>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <Select
              value={employeeFilter}
              onValueChange={onEmployeeFilterChange}
            >
              <SelectTrigger className='w-full sm:w-52'>
                <SelectValue placeholder={t('requestsUi.employee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>
                  {t('requestsUi.allEmployees')}
                </SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={onKindFilterChange}>
              <SelectTrigger className='w-full sm:w-48'>
                <SelectValue placeholder={t('requestsUi.requestType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>
                  {t('requestsUi.allRequestTypes')}
                </SelectItem>
                <SelectItem value='absence'>
                  {t('requests.kind.absence')}
                </SelectItem>
                <SelectItem value='booking-correction'>
                  {t('requests.kind.bookingCorrection')}
                </SelectItem>
                <SelectItem value='official-absence'>
                  {t('requests.kind.officialAbsence')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasSelection && (
          <div className='mt-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-sm'>
              {t('requestsUi.selectedForBatch', { count: selectedIds.length })}
            </div>
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                className='border-rose-200 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700'
                disabled={!!batchDecision}
                onClick={() =>
                  void decideSelected(
                    'reject',
                    t('requestsUi.rejectedInBatchReview')
                  )
                }
              >
                <XCircle className='h-4 w-4' />
                {batchDecision === 'reject'
                  ? t('requestsUi.rejecting')
                  : t('requestsUi.rejectSelected')}
              </Button>
              <Button
                size='sm'
                className='bg-emerald-600 text-white hover:bg-emerald-700'
                disabled={!!batchDecision}
                onClick={() =>
                  void decideSelected(
                    'approve',
                    t('requestsUi.approvedInBatchReview')
                  )
                }
              >
                <CheckCircle2 className='h-4 w-4' />
                {batchDecision === 'approve'
                  ? t('requestsUi.approving')
                  : t('requestsUi.approveSelected')}
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className='p-0'>
        <RequestTable
          rows={rows}
          isLoading={isLoading}
          showOwner
          embedded
          actions='approval'
          selectedIds={selectedIds}
          selectable
          onSelectAll={onSelectAll}
          onSelectRow={onSelectRow}
          onReview={onReview}
        />
      </CardContent>
    </Card>
  )
}
