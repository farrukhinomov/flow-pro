import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getBreakCompliance } from '@/domain/attendance/commands'
import type { ClockEventGeo, WorkLocation } from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { CalendarPlus, FileClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useSession } from '@/features/access/session-provider'
import { RouteError } from '@/features/errors/route-error'
import { useEmployeeRequests } from '@/features/requests/hooks/use-employee-requests'
import { useUserPreferences } from '@/features/settings/use-user-preferences'
import {
  AttentionCard,
  ClockEventsDrawer,
  DayTimelineCard,
  OpenRequestsCard,
  TodayStatusCard,
  TodayTotalsCard,
} from '@/features/today/components'
import { useTodayAttendance } from '@/features/today/hooks/use-today-attendance'
import { useTodayTimesheetRows } from '@/features/today/hooks/use-today-timesheet-rows'
import {
  getBrowserDevice,
  getOpenRequests,
  getStateMetrics,
  getWorkStateCopy,
} from '@/features/today/today-view-model'

export const Route = createFileRoute('/_authenticated/')({
  component: TodayPage,
  errorComponent: RouteError,
})

function TodayPage() {
  const today = useMemo(() => new Date(), [])
  const { session } = useSession()
  const { locale, t } = useI18n()
  const { preferences } = useUserPreferences()
  // Seeded from the account setting so the common case needs no interaction.
  // Local state still wins once touched: the default is a starting point, not
  // a constraint on where someone is working today.
  const [workLocation, setWorkLocation] = useState<WorkLocation | null>(null)
  const effectiveWorkLocation = workLocation ?? preferences.defaultWorkLocation
  const [geo, setGeo] = useState<ClockEventGeo | undefined>()
  const [isLocating, setIsLocating] = useState(false)
  const [isEventsDrawerOpen, setIsEventsDrawerOpen] = useState(false)
  const [yesterdayCloseTime, setYesterdayCloseTime] = useState('18:00')
  const device = useMemo(() => getBrowserDevice(t), [t])
  const {
    closeYesterday,
    clockIn,
    clockOut,
    events,
    isCommandPending,
    isLoading,
    projection,
    removeEvent,
    resumeWork,
    startBreak,
    syncMeta,
    updateEvent,
    yesterdayEvents,
    yesterdayProjection,
  } = useTodayAttendance(today)
  const { requests, users } = useEmployeeRequests()
  const firstName = session.displayName.split(' ')[0] || session.displayName
  const stateCopy = getWorkStateCopy(projection, firstName, t)
  const openRequests = useMemo(
    () =>
      getOpenRequests({
        employeeId: session.employeeId,
        requests,
      }),
    [requests, session.employeeId]
  )
  const metrics = getStateMetrics(projection, t)
  const breakCompliance = getBreakCompliance(projection)
  const hasOpenYesterday =
    yesterdayProjection.state === 'working' ||
    yesterdayProjection.state === 'break'
  const timelineDays = useMemo(
    () => [today, addCalendarDays(today, -1)],
    [today]
  )
  const { rows: todayRows } = useTodayTimesheetRows({
    days: timelineDays,
    employeeId: session.employeeId,
    events: [...events, ...yesterdayEvents],
    locale,
    requests,
    users,
  })
  const isPageLoading = isLoading

  const captureLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setIsLocating(false)
      },
      () => setIsLocating(false),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 }
    )
  }

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='min-w-0 overflow-x-hidden'>
        <div className='mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              {t('today.title')}
            </h1>
            <p className='mt-1 text-sm break-words text-muted-foreground'>
              {t('today.subtitle', {
                date: formatLocaleDate(today, locale, {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          </div>

          <div className='flex min-w-0 flex-wrap gap-2'>
            <Button size='sm' asChild>
              <Link to='/requests' search={{ kind: undefined }}>
                <CalendarPlus className='h-4 w-4 shrink-0' />
                <span>{t('today.newRequest')}</span>
              </Link>
            </Button>

            <Button variant='outline' size='sm' asChild>
              <Link to='/timesheet'>
                <FileClock className='h-4 w-4 shrink-0' />
                <span>{t('today.timesheet')}</span>
              </Link>
            </Button>
          </div>
        </div>

        <div className='grid w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden'>
          {isPageLoading ? (
            <TodayPageSkeleton />
          ) : (
            <>
              <div className='grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.72fr)_minmax(0,0.78fr)]'>
                <TodayStatusCard
                  deviceLabel={device.label}
                  geo={geo}
                  isCommandPending={isCommandPending}
                  isLoading={isLoading}
                  isLocating={isLocating}
                  metrics={metrics}
                  projection={projection}
                  stateCopy={stateCopy}
                  syncMeta={syncMeta}
                  workLocation={effectiveWorkLocation}
                  onCaptureLocation={captureLocation}
                  onClockIn={() =>
                    void clockIn(effectiveWorkLocation, { device, geo })
                  }
                  onClockOut={() => void clockOut()}
                  onManageBookings={() => setIsEventsDrawerOpen(true)}
                  onResumeWork={() => void resumeWork()}
                  onStartBreak={() => void startBreak()}
                  onWorkLocationChange={setWorkLocation}
                />
                <TodayTotalsCard
                  eventsCount={events.length}
                  projection={projection}
                />
                <AttentionCard
                  breakCompliance={breakCompliance}
                  hasOpenYesterday={hasOpenYesterday}
                  yesterdayCloseTime={yesterdayCloseTime}
                  onCloseYesterday={() =>
                    void closeYesterday(yesterdayCloseTime)
                  }
                  onYesterdayCloseTimeChange={setYesterdayCloseTime}
                />
              </div>

              <DayTimelineCard industrial={false} rows={todayRows} />

              <OpenRequestsCard requests={openRequests} />
            </>
          )}
        </div>

        <ClockEventsDrawer
          events={events}
          isLoading={isLoading}
          open={isEventsDrawerOpen}
          onOpenChange={setIsEventsDrawerOpen}
          onRemove={removeEvent}
          onSave={updateEvent}
        />
      </Main>
    </>
  )
}

function addCalendarDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(date.getDate() + amount)

  return next
}

function TodayPageSkeleton() {
  return (
    <>
      <div className='min-w-0 space-y-4 overflow-hidden'>
        <Card>
          <CardContent className='space-y-4 p-4'>
            <div className='space-y-2'>
              <Skeleton className='h-5 w-40' />
              <Skeleton className='h-4 w-72 max-w-full' />
            </div>
            <Skeleton className='h-14 w-full rounded-xl' />
            <div className='grid gap-3 sm:grid-cols-2'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-20 w-full' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='space-y-3 p-4'>
            <Skeleton className='h-5 w-40' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
          </CardContent>
        </Card>
      </div>

      <div className='min-w-0 space-y-4 overflow-hidden'>
        <Card>
          <CardContent className='grid gap-3 p-4 sm:grid-cols-3'>
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='space-y-3 p-4'>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-14 w-full' />
            <Skeleton className='h-14 w-full' />
            <Skeleton className='h-14 w-full' />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='space-y-3 p-4'>
            <Skeleton className='h-5 w-36' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-32' />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
