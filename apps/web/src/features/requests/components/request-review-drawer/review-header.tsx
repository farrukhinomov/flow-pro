import type { EmployeeRequest } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  calcBusinessDays,
  formatDateRange,
  getStatusLabel,
  statusStyles,
} from '../../request-view-model'

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border bg-muted/20 p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 text-sm font-medium'>{value}</div>
    </div>
  )
}

export function RequestReviewHeader({
  request,
  statusLabel,
  details,
}: {
  request: EmployeeRequest
  statusLabel: string
  details: string
}) {
  const { locale, t } = useI18n()
  const duration = calcBusinessDays(request.fromDate, request.toDate)

  return (
    <>
      <div className='grid gap-3 sm:grid-cols-3'>
        <ReviewMetric
          label={t('requestsUi.dates')}
          value={formatDateRange(request.fromDate, request.toDate, locale)}
        />
        <ReviewMetric
          label={t('requestsUi.duration')}
          value={`${duration} ${
            duration === 1
              ? t('requestsUi.daySingular')
              : t('requestsUi.dayPlural')
          }`}
        />
        <ReviewMetric
          label={t('requestsUi.submitted')}
          value={formatLocaleDate(request.submittedAt, locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        />
      </div>

      <div className='rounded-md border p-4'>
        <div className='mb-3 flex items-start justify-between gap-3'>
          <div>
            <h3 className='text-sm font-medium'>{statusLabel}</h3>
            <p className='mt-1 text-sm text-muted-foreground'>{details}</p>
          </div>
          <Badge
            variant='outline'
            className={cn('text-xs', statusStyles[request.status])}
          >
            {getStatusLabel(request.status, t)}
          </Badge>
        </div>
      </div>
    </>
  )
}
