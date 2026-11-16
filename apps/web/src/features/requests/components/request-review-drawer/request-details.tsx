import type { MaskedRequestView } from '@/domain/privacy/gdpr'
import type { EmployeeRequest } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { CheckCircle2, Clock3, Paperclip, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  formatFileSize,
  formatPartialDay,
  getRequestKindLabel,
} from '../../request-view-model'

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-right font-medium'>{value}</span>
    </div>
  )
}

export function RequestReviewDetails({
  request,
  requestView,
}: {
  request: EmployeeRequest
  requestView: MaskedRequestView
}) {
  const { t } = useI18n()
  return (
    <>
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <DetailLine
          label={t('requestsUi.person')}
          value={requestView.employeeName}
        />
        <DetailLine
          label={t('requestsUi.type')}
          value={getRequestKindLabel(request.kind, t)}
        />
        {request.clockIn && (
          <DetailLine label={t('requestsUi.clockIn')} value={request.clockIn} />
        )}
        {request.clockOut && (
          <DetailLine
            label={t('requestsUi.clockOut')}
            value={request.clockOut}
          />
        )}
        {request.kind === 'absence' && (
          <DetailLine
            label={t('requestsUi.dayLength')}
            value={formatPartialDay(request, t)}
          />
        )}
        {request.recurrence?.frequency === 'weekly' &&
          request.recurrence.occurrences > 1 && (
            <DetailLine
              label={t('requestsUi.series')}
              value={t('requestsUi.weeklyOccurrences', {
                count: request.recurrence.occurrences,
              })}
            />
          )}
        {requestView.attachments.length > 0 && (
          <DetailLine
            label={t('requestsUi.attachments')}
            value={t('requestsUi.filesCount', {
              count: requestView.attachments.length,
            })}
          />
        )}
      </div>

      {requestView.maskingReason && (
        <Alert>
          <ShieldCheck className='h-4 w-4' />
          <AlertTitle>{t('requestsUi.privateDetailsMasked')}</AlertTitle>
          <AlertDescription>{requestView.maskingReason}</AlertDescription>
        </Alert>
      )}

      {request.approvalFlow && (
        <div className='space-y-2'>
          <div className='text-sm font-medium'>
            {t('requestsUi.approvalRoute')}
          </div>
          {request.approvalFlow.autoApproved ? (
            <div className='rounded-md border bg-emerald-500/5 p-3 text-sm text-emerald-700'>
              {t('requestsUi.autoApprovedByPolicy')}
            </div>
          ) : (
            <div className='grid gap-2'>
              {request.approvalFlow.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 text-sm',
                    index === request.approvalFlow?.currentStepIndex &&
                      request.status === 'submitted' &&
                      'border-amber-300 bg-amber-500/5'
                  )}
                >
                  {step.status === 'approved' ? (
                    <CheckCircle2 className='mt-0.5 h-4 w-4 text-emerald-600' />
                  ) : (
                    <Clock3 className='mt-0.5 h-4 w-4 text-muted-foreground' />
                  )}
                  <div>
                    <div className='font-medium'>{step.label}</div>
                    <div className='text-xs text-muted-foreground'>
                      {step.approverNames.join(', ') ||
                        t('requestsUi.unassignedApprover')}{' '}
                      · {t(`requestsUi.approvalStepStatus.${step.status}`)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {requestView.attachments.length > 0 && (
        <div className='space-y-2'>
          <div className='text-sm font-medium'>
            {t('requestsUi.attachments')}
          </div>
          <div className='space-y-2'>
            {requestView.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className='flex items-center justify-between gap-3 rounded-md border p-3 text-sm'
              >
                <div className='min-w-0'>
                  <div className='truncate font-medium'>{attachment.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {formatFileSize(attachment.size)} · {attachment.type}
                  </div>
                </div>
                <Paperclip className='h-4 w-4 text-muted-foreground' />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='space-y-2'>
        <Label htmlFor='review-reason'>{t('requestsUi.employeeReason')}</Label>
        <div
          id='review-reason'
          className='min-h-20 rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground'
        >
          {requestView.reason ?? t('requestsUi.reasonHiddenByPolicy')}
        </div>
      </div>
    </>
  )
}
