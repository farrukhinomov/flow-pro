import type { AuditEvent } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/flowpro/empty-state'
import { DrawerTimelineSkeleton } from '@/components/flowpro/loading-skeletons'

export function RequestAuditTimeline({
  auditTrail,
  auditVisible,
  isLoading = false,
}: {
  auditTrail: AuditEvent[]
  auditVisible: boolean
  isLoading?: boolean
}) {
  const { locale, t } = useI18n()
  if (!auditVisible) {
    return (
      <Alert>
        <ShieldCheck className='h-4 w-4' />
        <AlertTitle>{t('requestsUi.auditHidden')}</AlertTitle>
        <AlertDescription>
          {t('requestsUi.auditHiddenDescription')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='text-sm font-medium'>{t('requestsUi.auditTimeline')}</div>
      {isLoading ? (
        <DrawerTimelineSkeleton items={4} />
      ) : (
        <div className='space-y-2'>
          {auditTrail.length === 0 ? (
            <EmptyState
              className='min-h-40'
              title={t('requestsUi.noAuditEvents')}
              description={t('requestsUi.noAuditEventsDescription')}
            />
          ) : (
            auditTrail.map((event) => (
              <div key={event.id} className='rounded-md border p-3'>
                <div className='flex items-center justify-between gap-3 text-sm'>
                  <span className='font-medium'>{event.summary}</span>
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {formatLocaleDate(event.createdAt, locale, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className='mt-1 text-xs text-muted-foreground'>
                  {event.actorName} · {event.action}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
