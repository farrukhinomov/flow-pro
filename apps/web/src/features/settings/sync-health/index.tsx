import { useState } from 'react'
import { applicationStore } from '@/application/application-store'
import { projectionHydrationModules } from '@/application/application-store-hydration'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { useI18n, type Locale } from '@/i18n'
import { formatRelativeTime } from '@/i18n/format'
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  DatabaseZap,
  Loader2,
  RefreshCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSyncStatus } from '@/features/sync/use-sync-status'
import { ContentSection } from '../components/content-section'

export function SettingsSyncHealth() {
  const { locale, t } = useI18n()
  const { isLoading, isRetrying, retry, storeCounts, syncMeta } =
    useSyncStatus()
  const [isHydrating, setIsHydrating] = useState(false)
  const hydrationModules = syncMeta?.projectionHydration ?? {}
  const hasHydrationError = projectionHydrationModules.some(
    (module) => !!hydrationModules[module]?.lastError
  )
  const isOffline = syncMeta?.isOnline === false

  const hydrate = async () => {
    setIsHydrating(true)

    try {
      const result = await applicationStore.hydrateProjections()

      if (result.ok) {
        toast.success(t('syncHealthUi.hydrationComplete'))
      } else {
        toast.warning(t('syncHealthUi.hydrationCompletedWithErrors'))
      }

      await retry()
    } catch (error) {
      toast.error(
        resolveApiErrorMessage(error, t, 'syncHealthUi.hydrationFailed')
      )
    } finally {
      setIsHydrating(false)
    }
  }

  return (
    <ContentSection
      title={t('syncHealthUi.title')}
      desc={t('syncHealthUi.description')}
    >
      <div className='space-y-4'>
        {(isOffline || hasHydrationError || syncMeta?.lastError) && (
          <Alert>
            <AlertTriangle className='h-4 w-4' />
            <AlertTitle>{t('syncHealthUi.attentionRequired')}</AlertTitle>
            <AlertDescription>
              {syncMeta?.lastError ??
                t('syncHealthUi.projectionHydrationNeedsAttention')}
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <HealthMetric
            label={t('syncHealthUi.onlineState')}
            value={
              isOffline ? t('syncHealthUi.offline') : t('syncHealthUi.online')
            }
            tone={isOffline ? 'warning' : 'ok'}
            icon={isOffline ? CloudOff : CheckCircle2}
          />
          <HealthMetric
            label={t('syncHealthUi.pendingOutbox')}
            value={syncMeta?.pendingCount ?? 0}
            tone={(syncMeta?.pendingCount ?? 0) > 0 ? 'warning' : 'ok'}
            icon={DatabaseZap}
          />
          <HealthMetric
            label={t('syncHealthUi.lastSuccessfulSync')}
            value={formatLastSeen(syncMeta?.lastSyncedAt, locale, t)}
            icon={RefreshCcw}
          />
          <HealthMetric
            label={t('syncHealthUi.serverCursor')}
            value={syncMeta?.serverCursor ?? 0}
            icon={DatabaseZap}
          />
        </div>

        <Card>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='text-base'>
                {t('syncHealthUi.projectionFeeds')}
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                {t('syncHealthUi.projectionFeedsDescription')}
              </p>
            </div>
            <Button
              className='gap-2 self-start sm:self-auto'
              size='sm'
              onClick={() => void hydrate()}
              disabled={isHydrating || isRetrying}
            >
              {isHydrating ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <RefreshCcw className='h-4 w-4' />
              )}
              {t('syncHealthUi.hydrateProjections')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('syncHealthUi.module')}</TableHead>
                    <TableHead>{t('syncHealthUi.items')}</TableHead>
                    <TableHead>{t('syncHealthUi.lastHydrated')}</TableHead>
                    <TableHead>{t('syncHealthUi.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectionHydrationModules.map((module) => {
                    const status = hydrationModules[module]
                    const error = status?.lastError

                    return (
                      <TableRow key={module}>
                        <TableCell className='font-medium'>
                          {t(`syncHealthUi.modules.${module}`)}
                        </TableCell>
                        <TableCell>{status?.itemCount ?? 0}</TableCell>
                        <TableCell>
                          {formatLastSeen(status?.lastHydratedAt, locale, t)}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-col gap-1'>
                            <Badge
                              variant={error ? 'secondary' : 'outline'}
                              className='w-fit'
                            >
                              {error
                                ? t('syncHealthUi.needsAttention')
                                : status?.lastHydratedAt
                                  ? t('syncHealthUi.healthy')
                                  : t('syncHealthUi.notHydrated')}
                            </Badge>
                            {error && (
                              <span className='max-w-80 text-xs text-muted-foreground'>
                                {error}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {t('syncHealthUi.localStoreCounts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='text-sm text-muted-foreground'>
                {t('common.loading')}
              </div>
            ) : (
              <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                {storeCounts &&
                  Object.entries(storeCounts).map(([storeName, count]) => (
                    <div
                      key={storeName}
                      className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                    >
                      <span className='truncate text-muted-foreground'>
                        {storeName}
                      </span>
                      <span className='font-mono font-semibold'>{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
}

type HealthMetricProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone?: 'default' | 'ok' | 'warning'
  value: React.ReactNode
}

function HealthMetric({
  icon: Icon,
  label,
  tone = 'default',
  value,
}: HealthMetricProps) {
  return (
    <Card>
      <CardContent className='flex items-center gap-3 p-4'>
        <div
          className={
            tone === 'ok'
              ? 'text-emerald-600'
              : tone === 'warning'
                ? 'text-amber-600'
                : 'text-muted-foreground'
          }
        >
          <Icon className='h-5 w-5' />
        </div>
        <div className='min-w-0'>
          <div className='text-xs text-muted-foreground'>{label}</div>
          <div className='truncate text-sm font-semibold'>{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatLastSeen(
  value: string | undefined,
  locale: Locale,
  t: (key: string) => string
) {
  if (!value) return t('syncHealthUi.never')

  return formatRelativeTime(value, locale)
}
