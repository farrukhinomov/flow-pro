import { Link } from '@tanstack/react-router'
import type {
  ClockEventGeo,
  SyncMeta,
  TodayProjection,
  WorkLocation,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import {
  Clock3,
  FileClock,
  MapPin,
  Pause,
  Pencil,
  Play,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { LiveRegion } from '@/components/live-region'
import {
  getTodayPrimaryAction,
  type StateMetric,
  type WorkStateCopy,
} from '../today-view-model'

export function TodayStatusCard({
  deviceLabel,
  geo,
  isLoading,
  isCommandPending,
  isLocating,
  metrics,
  onCaptureLocation,
  onClockIn,
  onClockOut,
  onManageBookings,
  onResumeWork,
  onStartBreak,
  onWorkLocationChange,
  projection,
  stateCopy,
  syncMeta,
  workLocation,
}: {
  deviceLabel: string
  geo?: ClockEventGeo
  isLoading: boolean
  isCommandPending: boolean
  isLocating: boolean
  metrics: StateMetric[]
  onCaptureLocation: () => void
  onClockIn: () => void
  onClockOut: () => void
  onManageBookings: () => void
  onResumeWork: () => void
  onStartBreak: () => void
  onWorkLocationChange: (location: WorkLocation) => void
  projection: TodayProjection
  stateCopy: WorkStateCopy
  syncMeta: SyncMeta | null
  workLocation: WorkLocation
}) {
  const { t } = useI18n()
  const primaryAction = getTodayPrimaryAction(projection.state)

  return (
    <Card className='gap-4 overflow-hidden py-4 md:col-span-2 xl:col-span-1'>
      {/*
        Clocking in or out is the most-used action in the product and it changes
        the page without moving focus, so the new work state is announced. The
        success toast only says the booking was saved.
      */}
      <LiveRegion
        message={
          isLoading
            ? ''
            : t('todayUi.workStateAnnouncement', { state: stateCopy.status })
        }
      />
      <CardHeader className='px-4 pb-0'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Clock3 className='h-4 w-4 text-muted-foreground' />
              {stateCopy.greeting}
            </CardTitle>
            <CardDescription>{stateCopy.description}</CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge
              variant='outline'
              className={cn('w-fit', stateCopy.badgeClass)}
            >
              {stateCopy.badge}
            </Badge>
            {!!syncMeta?.pendingCount && (
              <Badge variant='outline' className='w-fit'>
                {t('requestsPage.syncing', {
                  count: String(syncMeta.pendingCount),
                })}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        <div className='rounded-lg border bg-muted/20 p-3'>
          <div className='text-sm text-muted-foreground'>
            {t('todayUi.status')}
          </div>
          <div className='mt-0.5 text-xl font-semibold tracking-tight'>
            {isLoading ? t('todayUi.preparingToday') : stateCopy.status}
          </div>
        </div>

        {(projection.state === 'not-working' ||
          projection.state === 'finished') && (
          <div className='grid gap-2 sm:grid-cols-[160px_220px] sm:items-center'>
            <div className='text-sm text-muted-foreground'>
              {projection.state === 'finished'
                ? t('todayUi.nextLocation')
                : t('todayUi.workLocation')}
            </div>
            <Select
              value={workLocation}
              onValueChange={(value) =>
                onWorkLocationChange(value as WorkLocation)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='office'>{t('common.office')}</SelectItem>
                <SelectItem value='home-office'>
                  {t('common.homeOffice')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {metrics.map((item) => (
            <div key={item.label} className='min-w-0 rounded-lg border p-2.5'>
              <div className='truncate text-[11px] text-muted-foreground'>
                {item.label}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-base font-semibold',
                  item.numeric !== false && 'font-mono tabular-nums',
                  item.positive && 'text-emerald-500'
                )}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className='grid grid-cols-2 gap-2'>
          {(primaryAction === 'clock-in' ||
            primaryAction === 'clock-in-again') && (
            <Button
              size='sm'
              className='col-span-2 w-full justify-center'
              disabled={isCommandPending}
              onClick={onClockIn}
            >
              <Play className='h-4 w-4 fill-current' />
              {primaryAction === 'clock-in-again'
                ? t('todayUi.clockInAgain')
                : t('todayUi.clockIn')}
            </Button>
          )}

          {primaryAction === 'clock-out' && (
            <>
              <Button
                size='sm'
                className='w-full justify-center'
                disabled={isCommandPending}
                onClick={onClockOut}
              >
                <Square className='h-4 w-4 fill-current' />
                {t('todayUi.clockOut')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                className='w-full justify-center'
                disabled={isCommandPending}
                onClick={onStartBreak}
              >
                <Pause className='h-4 w-4 fill-current' />
                {t('todayUi.startBreak')}
              </Button>
            </>
          )}

          {primaryAction === 'resume-work' && (
            <Button
              size='sm'
              className='col-span-2 w-full justify-center'
              disabled={isCommandPending}
              onClick={onResumeWork}
            >
              <Play className='h-4 w-4 fill-current' />
              {t('todayUi.resumeWork')}
            </Button>
          )}
        </div>

        {projection.state === 'finished' && (
          <div className='grid gap-2 pt-1 sm:flex sm:flex-wrap'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/requests' search={{ kind: 'booking' }}>
                <FileClock className='h-4 w-4' />
                {t('todayUi.correctTodaysTime')}
              </Link>
            </Button>
          </div>
        )}

        {projection.state === 'not-working' && (
          <div className='grid gap-2 pt-1 sm:flex sm:flex-wrap'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/requests' search={{ kind: 'absence' }}>
                {t('todayUi.requestLeave')}
              </Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/requests' search={{ kind: 'booking' }}>
                {t('todayUi.correctMissingTime')}
              </Link>
            </Button>
          </div>
        )}

        <div className='rounded-lg border bg-muted/20 p-3'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='text-sm font-medium'>
                {t('todayUi.bookingSource')}
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {deviceLabel}
                {geo
                  ? ` · ${t('todayUi.locationCapturedWithin', { meters: String(Math.round(geo.accuracy ?? 0)) })}`
                  : ` · ${t('todayUi.locationOptional')}`}
              </div>
            </div>
            <div className='grid gap-2 sm:flex sm:flex-wrap'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='gap-2'
                disabled={isLocating}
                onClick={onCaptureLocation}
              >
                <MapPin className='h-4 w-4' />
                {geo
                  ? t('todayUi.updateLocation')
                  : isLocating
                    ? t('todayUi.locating')
                    : t('todayUi.captureLocation')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='gap-2'
                onClick={onManageBookings}
              >
                <Pencil className='h-4 w-4' />
                {t('todayUi.manageBookings')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
