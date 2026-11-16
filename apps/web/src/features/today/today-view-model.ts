import { format } from 'date-fns'
import type {
  ClockEvent,
  ClockEventDevice,
  ClockEventSource,
  TodayProjection,
  WorkLocation,
} from '@/domain/attendance/types'
import type {
  EmployeeRequest,
  EmployeeRequestStatus,
} from '@/domain/requests/types'
import { DEFAULT_LOCALE, type Locale } from '@/i18n'
import { formatDateRange } from '@/i18n/format'
import { tStatic } from '@/i18n/static'

export const requestStatusStyles: Record<EmployeeRequestStatus, string> = {
  submitted:
    'border-amber-200 bg-amber-500/10 text-amber-600 dark:border-amber-800',
  approved:
    'border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:border-emerald-800',
  cancelled:
    'border-slate-200 bg-slate-500/10 text-slate-600 dark:border-slate-800',
  rejected: 'border-rose-200 bg-rose-500/10 text-rose-600 dark:border-rose-800',
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

export type WorkStateCopy = {
  greeting: string
  status: string
  description: string
  badge: string
  badgeClass: string
}

export type StateMetric = {
  label: string
  value: string
  positive?: boolean
  // Durations and clock times are monospaced so they line up. Word values such
  // as the work location are not, so they match the rest of the card.
  numeric?: boolean
}

export type TodayPrimaryAction =
  'clock-in' | 'clock-out' | 'resume-work' | 'clock-in-again'

const fallbackTranslate: Translate = (key, vars) => tStatic(key, vars)

export function getLocationLabel(
  location: WorkLocation,
  t: Translate = fallbackTranslate
) {
  return location === 'office' ? t('common.office') : t('common.homeOffice')
}

export function getSourceLabel(
  source: ClockEventSource,
  t: Translate = fallbackTranslate
) {
  if (source === 'manual') return t('todayUi.manualCorrection')
  if (source === 'system') return t('todayUi.system')
  if (source === 'terminal') return t('todayUi.terminal')
  return t('todayUi.browser')
}

export function getEventTypeLabel(
  type: ClockEvent['type'],
  t: Translate = fallbackTranslate
) {
  if (type === 'clock-in') return t('todayUi.clockIn')
  if (type === 'clock-out') return t('todayUi.clockOut')
  if (type === 'resume-work') return t('todayUi.resumeWork')
  return t('todayUi.startBreak')
}

export function getRequestKindLabel(
  kind: EmployeeRequest['kind'],
  t: Translate = fallbackTranslate
) {
  if (kind === 'absence') return t('requests.kind.absence')
  if (kind === 'booking-correction') return t('requests.kind.bookingCorrection')
  return t('requests.kind.officialAbsence')
}

/**
 * A booking can only be corrected or voided once the server has persisted it.
 * Pending, syncing, failed, conflicted, or local-only events still carry a
 * client-generated id that the correction/void endpoints do not recognise, so
 * editing them would fail server-side. The UI must wait for the sync to land.
 */
export function canEditClockEvent(event: Pick<ClockEvent, 'syncState'>) {
  return event.syncState === 'synced'
}

export function getTodayPrimaryAction(state: TodayProjection['state']) {
  if (state === 'not-working') return 'clock-in' as TodayPrimaryAction
  if (state === 'working') return 'clock-out' as TodayPrimaryAction
  if (state === 'break') return 'resume-work' as TodayPrimaryAction
  return 'clock-in-again' as TodayPrimaryAction
}

export function getBrowserDevice(
  t: Translate = fallbackTranslate
): ClockEventDevice {
  if (typeof navigator === 'undefined') {
    return { label: t('todayUi.unknownDevice'), type: 'unknown' }
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  return {
    label: isMobile ? t('todayUi.mobileBrowser') : t('todayUi.desktopBrowser'),
    type: isMobile ? 'mobile' : 'browser',
  }
}

export function eventDateTimeValue(iso: string) {
  const date = new Date(iso)

  return `${format(date, 'yyyy-MM-dd')}T${format(date, 'HH:mm')}`
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalMinutes = Math.floor(safeMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatSignedDuration(ms: number) {
  const sign = ms >= 0 ? '+' : '-'

  return `${sign}${formatDuration(Math.abs(ms))}`
}

export function getTimeLabel(iso?: string) {
  return iso ? format(new Date(iso), 'HH:mm') : '-'
}

export function getWorkStateCopy(
  projection: TodayProjection,
  firstName: string,
  t: Translate = fallbackTranslate
): WorkStateCopy {
  const { location, state } = projection
  const locationLabel = getLocationLabel(location, t)

  if (state === 'not-working') {
    return {
      greeting: t('todayUi.goodMorning', { name: firstName }),
      status: t('todayUi.notWorking'),
      description: t('todayUi.chooseLocationClockIn'),
      badge: t('todayUi.ready'),
      badgeClass: 'border-slate-200 bg-slate-500/10 text-slate-600',
    }
  }

  if (state === 'working') {
    return {
      greeting: t('todayUi.youAreWorking'),
      status: t('todayUi.workingStarted', {
        time: getTimeLabel(projection.startedAt),
      }),
      description: t('todayUi.currentLocation', { location: locationLabel }),
      badge: t('todayUi.workingBadge'),
      badgeClass: 'border-emerald-200 bg-emerald-500/10 text-emerald-600',
    }
  }

  if (state === 'break') {
    return {
      greeting: t('todayUi.breakInProgress'),
      status: t('todayUi.onBreak', {
        duration: formatDuration(projection.breakMs),
      }),
      description: t('todayUi.resumeAfterBreak'),
      badge: t('todayUi.onBreakBadge'),
      badgeClass: 'border-amber-200 bg-amber-500/10 text-amber-600',
    }
  }

  return {
    greeting: t('todayUi.finishedForToday'),
    status: t('todayUi.finishedForToday'),
    description: t('todayUi.finishedForTodayDescription'),
    badge: t('todayUi.finished'),
    badgeClass: 'border-blue-200 bg-blue-500/10 text-blue-600',
  }
}

export function getRequestDetails(
  request: EmployeeRequest,
  t: Translate = fallbackTranslate,
  locale: Locale = DEFAULT_LOCALE
) {
  if (request.kind === 'booking-correction') {
    return [
      request.clockIn && `${t('todayUi.in')} ${request.clockIn}`,
      request.clockOut && `${t('todayUi.out')} ${request.clockOut}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // Parsed at local midnight so the rendered day never shifts across the UTC
  // boundary for users east or west of the server.
  const range = formatDateRange(
    `${request.fromDate}T00:00:00`,
    `${request.toDate}T00:00:00`,
    locale
  )

  return `${request.statusLabel ?? request.subtype} · ${range}`
}

export function getStateMetrics(
  projection: TodayProjection,
  t: Translate = fallbackTranslate
): StateMetric[] {
  const locationLabel = getLocationLabel(projection.location, t)

  if (projection.state === 'not-working') {
    return [
      {
        label: t('todayUi.workedToday'),
        value: formatDuration(projection.workedMs),
      },
      {
        label: t('todayUi.breakToday'),
        value: formatDuration(projection.breakMs),
      },
      { label: t('todayUi.location'), value: locationLabel, numeric: false },
    ]
  }

  if (projection.state === 'working') {
    return [
      {
        label: t('todayUi.workedToday'),
        value: formatDuration(projection.workedMs),
      },
      {
        label: t('todayUi.started'),
        value: getTimeLabel(projection.startedAt),
      },
      { label: t('todayUi.location'), value: locationLabel, numeric: false },
    ]
  }

  if (projection.state === 'break') {
    return [
      {
        label: t('todayUi.workedToday'),
        value: formatDuration(projection.workedMs),
      },
      {
        label: t('todayUi.breakToday'),
        value: formatDuration(projection.breakMs),
      },
      {
        label: t('todayUi.breakStarted'),
        value: getTimeLabel(projection.breakStartedAt),
      },
    ]
  }

  return [
    { label: t('todayUi.worked'), value: formatDuration(projection.workedMs) },
    {
      label: t('todayUi.flex'),
      value: formatSignedDuration(projection.flexMs),
      positive: projection.flexMs >= 0,
    },
    { label: t('todayUi.break'), value: formatDuration(projection.breakMs) },
  ]
}

export function getOpenRequests({
  employeeId,
  requests,
}: {
  employeeId: string
  requests: EmployeeRequest[]
}) {
  return requests
    .filter(
      (request) =>
        request.employeeId === employeeId && request.status === 'submitted'
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )
    .slice(0, 4)
}

export function getTimelineLabel(
  label: string,
  t: Translate = fallbackTranslate
) {
  const labels: Record<string, string> = {
    'timeline.empty': t('todayUi.timelineEmpty'),
    'timeline.clock-in.office': t('todayUi.timelineClockedInOffice'),
    'timeline.clock-in.home-office': t('todayUi.timelineClockedInHomeOffice'),
    'timeline.start-break': t('todayUi.timelineBreakStarted'),
    'timeline.resume-work': t('todayUi.timelineResumedWork'),
    'timeline.clock-out': t('todayUi.timelineClockedOut'),
  }
  return labels[label] ?? label
}
