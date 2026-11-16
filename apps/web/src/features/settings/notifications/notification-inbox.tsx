import type { FlowProNotification } from '@/domain/notifications/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { Bell, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotificationSummary } from '@/features/notifications/use-notification-summary'

export function NotificationInbox() {
  const { t } = useI18n()
  const { isLoading, markAllRead, markRead, notifications, unreadCount } =
    useNotificationSummary()
  const visibleNotifications = notifications.slice(0, 8)

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0 pb-3'>
        <div className='space-y-1'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Bell className='size-4 text-muted-foreground' />
            {t('settingsUi.recentNotifications')}
          </CardTitle>
          <p className='text-xs text-muted-foreground'>
            {t('settingsUi.recentNotificationsDescription')}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {unreadCount > 0 ? (
            <>
              <Badge variant='secondary' className='rounded-full'>
                {t('settingsUi.unreadNotifications', {
                  count: unreadCount > 99 ? '99+' : unreadCount,
                })}
              </Badge>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs'
                onClick={() => void markAllRead()}
              >
                {t('settingsUi.markAllRead')}
              </Button>
            </>
          ) : (
            <Badge variant='outline' className='rounded-full'>
              {t('settingsUi.allRead')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            {t('settingsUi.loadingNotifications')}
          </div>
        ) : visibleNotifications.length > 0 ? (
          <div className='max-h-72 space-y-2 overflow-y-auto pe-1'>
            {visibleNotifications.map((notification) => (
              <NotificationInboxRow
                key={notification.id}
                notification={notification}
                onMarkRead={markRead}
              />
            ))}
          </div>
        ) : (
          <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            {t('settingsUi.noSyncedNotificationsYet')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NotificationInboxRow({
  notification,
  onMarkRead,
}: {
  notification: FlowProNotification
  onMarkRead: (notificationId: string) => Promise<void>
}) {
  const { locale, t } = useI18n()
  const isUnread = !notification.readAt
  const createdAt = new Date(notification.createdAt)
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? t('settingsUi.recently')
    : formatLocaleDate(createdAt, locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })

  return (
    <article
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isUnread ? 'bg-muted/40' : 'bg-background'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex items-center gap-2'>
            {isUnread ? (
              <span className='size-2 rounded-full bg-primary' />
            ) : (
              <CheckCircle2 className='size-3.5 text-muted-foreground' />
            )}
            <h4 className='truncate text-sm font-medium'>
              {notification.title}
            </h4>
          </div>
          <p className='text-xs text-muted-foreground'>
            {notification.type.replace(/-/g, ' ')}
          </p>
        </div>
        <time className='shrink-0 text-xs text-muted-foreground'>
          {createdLabel}
        </time>
      </div>
      {isUnread ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='mt-2 h-7 px-2 text-xs'
          onClick={() => void onMarkRead(notification.id)}
        >
          {t('settingsUi.markRead')}
        </Button>
      ) : null}
    </article>
  )
}
