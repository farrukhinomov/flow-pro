import { format } from 'date-fns'
import { toCalendarDay } from '@/domain/attendance/calendar-day'
import {
  foldClockEvents,
  msToHours,
} from '@/domain/attendance/clock-projection'
import type {
  AppliedTimeCorrection,
  ClockEvent,
  MonthlyTimesheetApproval,
  WorkContract,
} from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { PayrollExport } from '@/domain/timesheet/exports'
import { findGermanPublicHoliday } from '@/domain/timesheet/german-holidays'
import { getTargetHoursForDate } from '@/domain/timesheet/policies'
import type { Locale } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { tStatic } from '@/i18n/static'
import { AlertTriangle, Home } from 'lucide-react'
import {
  BREAK_MARKER,
  HOME_OFFICE_MARKER,
  OPEN_CLOCK_OUT,
} from './timesheet-constants'
import { timeToMinutes } from './timesheet-formatting'
import type { DayBadge, DayRow, HolidayStats, TimesheetMetrics } from './types'

export const CURRENT_DATE = format(new Date(), 'yyyy-MM-dd')

export const VACATION_BALANCE_STATS: HolidayStats = {
  annual: 30,
  disability: 0,
  extra1: 0,
  extra2: 0,
  fromPrev: 5,
  expired: 0,
  taken: 10,
  remaining: 25,
  planned: 15,
  available: 10,
}

const FALLBACK_TARGET_HOURS = 8
const EXPORT_STATUS_SEPARATOR = ' · '

const DAY_BADGE_LABELS = {
  corrected: 'timesheetUi.badges.corrected',
  holiday: 'timesheetUi.badges.holiday',
  longBreak: 'timesheetUi.badges.longBreak',
  missing: 'timesheetUi.badges.missing',
  negativeFlex: 'timesheetUi.badges.negativeFlex',
  planned: 'timesheetUi.badges.planned',
  plusFlex: 'timesheetUi.badges.plusFlex',
  weekend: 'timesheetUi.badges.weekend',
  homeOffice: 'timesheetUi.badges.homeOffice',
} as const

function getExportStatusLabels() {
  return {
    corrected: tStatic('timesheetUi.exportStatus.corrected'),
    publicHoliday: tStatic('timesheetUi.exportStatus.publicHoliday'),
    weekend: tStatic('timesheetUi.exportStatus.weekend'),
    workday: tStatic('timesheetUi.exportStatus.workday'),
  }
}

export function isPastWorkday(row: DayRow, currentDate = CURRENT_DATE) {
  return row.date < currentDate && !row.isWeekend && !row.isHoliday
}

export function isException(row: DayRow, currentDate = CURRENT_DATE) {
  if (isPastWorkday(row, currentDate) && row.clockIns.length === 0) return true
  if ((row.flex ?? 0) < 0) return true
  if ((row.breakDiff ?? 0) < -1.5) return true

  return false
}

export function getDayBadges(
  row: DayRow,
  currentDate = CURRENT_DATE
): DayBadge[] {
  const badges: DayBadge[] = []

  if (row.isHoliday)
    badges.push({ labelKey: DAY_BADGE_LABELS.holiday, tone: 'default' })
  if (row.isWeekend)
    badges.push({ labelKey: DAY_BADGE_LABELS.weekend, tone: 'muted' })
  if (row.correction)
    badges.push({ labelKey: DAY_BADGE_LABELS.corrected, tone: 'success' })
  if (row.absences.includes(HOME_OFFICE_MARKER)) {
    badges.push({
      labelKey: DAY_BADGE_LABELS.homeOffice,
      tone: 'remote',
      icon: Home,
    })
  }
  if (isPastWorkday(row, currentDate) && row.clockIns.length === 0) {
    badges.push({
      labelKey: DAY_BADGE_LABELS.missing,
      tone: 'danger',
      icon: AlertTriangle,
    })
  }
  if ((row.flex ?? 0) < 0) {
    badges.push({ labelKey: DAY_BADGE_LABELS.negativeFlex, tone: 'danger' })
  }
  if ((row.flex ?? 0) > 0) {
    badges.push({ labelKey: DAY_BADGE_LABELS.plusFlex, tone: 'success' })
  }
  if ((row.breakDiff ?? 0) < -1.5) {
    badges.push({ labelKey: DAY_BADGE_LABELS.longBreak, tone: 'warning' })
  }
  if (badges.length === 0) {
    badges.push({ labelKey: DAY_BADGE_LABELS.planned, tone: 'muted' })
  }

  return badges
}

export function createMonthRows(
  periodMonth: string,
  workContract: WorkContract,
  locale: Locale = 'en',
  /**
   * Federal state whose holiday calendar applies. Omitted falls back to the nationwide set,
   * which every state observes, so a caller without policy loaded still gets valid rows.
   */
  regionCode?: string
): DayRow[] {
  const [year, month] = periodMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  const buildRowLabel = (date: Date) =>
    `${formatLocaleDate(date, locale, { day: '2-digit' })}/${formatLocaleDate(date, locale, { month: '2-digit' })} ${formatLocaleDate(date, locale, { weekday: 'short' })}`

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${periodMonth}-${String(index + 1).padStart(2, '0')}`
    const day = new Date(`${date}T12:00:00`)
    const holiday = findGermanPublicHoliday(date, regionCode)
    const isWeekend = day.getDay() === 0 || day.getDay() === 6
    const target = getTargetHoursForDate(workContract, date)

    return {
      absences: [],
      clockIns: [],
      clockOuts: [],
      date,
      flex: holiday && target ? 0 : undefined,
      holidayName: holiday?.name,
      isHoliday: !!holiday,
      isWeekend,
      label: buildRowLabel(day),
      paid: holiday && target ? target : undefined,
      target,
      total: holiday && target ? target : undefined,
    }
  })
}

export function applyApprovedAbsencesToRows({
  baseRows,
  employeeId,
  periodMonth,
  requests,
}: {
  baseRows: DayRow[]
  employeeId: string
  periodMonth: string
  requests: EmployeeRequest[]
}) {
  const approvedAbsences = requests.filter(
    (request) =>
      request.employeeId === employeeId &&
      request.kind === 'absence' &&
      request.status === 'approved' &&
      request.fromDate <= `${periodMonth}-31` &&
      request.toDate >= `${periodMonth}-01`
  )

  return baseRows.map((row) => {
    const absence = approvedAbsences.find(
      (request) => request.fromDate <= row.date && request.toDate >= row.date
    )

    if (!absence) return row

    const target = row.target
    const paid = target ?? 0

    return {
      ...row,
      absences: Array.from(
        new Set([...row.absences, absence.statusCode ?? absence.subtype])
      ),
      flex: target !== undefined ? (row.total ?? paid) - target : row.flex,
      paid,
      total: row.total ?? paid,
    }
  })
}

export function projectClockEventsToDay(
  row: DayRow,
  events: ClockEvent[]
): DayRow {
  if (events.length === 0) return row

  // The accumulation itself lives in the domain, shared with the payroll report, because
  // the two used to carry separate copies of it and their millisecond conversions drifted.
  const projection = foldClockEvents(events)
  const clockIns: string[] = []
  const clockOuts: string[] = []

  projection.transitions.forEach((transition) => {
    const time = format(new Date(transition.occurredAt), 'HH:mm')
    const atHome = transition.location === 'home-office'

    if (transition.type === 'clock-in' || transition.type === 'resume-work') {
      clockIns.push(time)
    }

    if (transition.type === 'start-break' && transition.closedWork) {
      clockOuts.push(`${time} ${atHome ? HOME_OFFICE_MARKER : BREAK_MARKER}`)
    }

    if (transition.type === 'clock-out') {
      if (transition.closedWork) {
        clockOuts.push(
          `${time}${atHome ? ` ${HOME_OFFICE_MARKER}` : ''}`.trim()
        )
      }
      if (transition.closedBreak) {
        clockOuts.push(time)
      }
    }
  })

  if (projection.hasOpenShift && clockOuts.length < clockIns.length) {
    clockOuts.push(OPEN_CLOCK_OUT)
  }

  const total = msToHours(projection.workedMs)
  const breakTaken = msToHours(projection.breakMs)
  const target =
    row.target ??
    (row.isWeekend || row.isHoliday ? undefined : FALLBACK_TARGET_HOURS)

  return {
    ...row,
    absences:
      events.some((event) => event.location === 'home-office') &&
      !row.absences.includes(HOME_OFFICE_MARKER)
        ? [...row.absences, HOME_OFFICE_MARKER]
        : row.absences,
    breakDiff: breakTaken ? -breakTaken : undefined,
    breakTaken: breakTaken || undefined,
    clockIns,
    clockOuts,
    flex: target !== undefined ? total - target : undefined,
    paid: total,
    prod: total,
    target,
    total,
  }
}

export function applyCorrectionToDay(
  row: DayRow,
  correction?: AppliedTimeCorrection
): DayRow {
  if (!correction) return row

  if (correction.proposedEvents) {
    return {
      ...projectClockEventsToDay(
        {
          ...row,
          clockIns: [],
          clockOuts: [],
        },
        correction.proposedEvents.map((event) => ({
          ...event,
          employeeId: correction.employeeId,
          source: 'manual',
          syncState: 'synced',
        }))
      ),
      correction,
    }
  }

  const clockIns = correction.clockIn ? [correction.clockIn] : row.clockIns
  const clockOuts = correction.clockOut ? [correction.clockOut] : row.clockOuts
  const startMinutes = timeToMinutes(clockIns[0])
  const endMinutes = timeToMinutes(clockOuts[0])
  const total =
    startMinutes !== undefined && endMinutes !== undefined
      ? Math.max(0, (endMinutes - startMinutes) / 60)
      : (row.total ?? row.prod)
  const target =
    row.target ??
    (row.isWeekend || row.isHoliday ? undefined : FALLBACK_TARGET_HOURS)

  return {
    ...row,
    breakDiff: undefined,
    breakTaken: undefined,
    clockIns,
    clockOuts,
    correction,
    flex:
      target !== undefined && total !== undefined ? total - target : row.flex,
    paid: total,
    prod: total,
    target,
    total,
  }
}

export function mergeRowsWithClockEvents({
  baseRows,
  corrections,
  events,
  periodMonth,
  timeZone,
}: {
  baseRows: DayRow[]
  corrections: AppliedTimeCorrection[]
  events: ClockEvent[]
  periodMonth: string
  /** Workspace zone anchoring day assignment; browser zone when unknown. */
  timeZone?: string
}) {
  const eventsByDay = events.reduce<Record<string, ClockEvent[]>>(
    (grouped, event) => {
      // Was `occurredAt.slice(0, 10)`, the UTC date, which filed a 00:30
      // local clock-out under the previous day in the payroll record.
      const day = toCalendarDay(event.occurredAt, timeZone)

      if (day.startsWith(periodMonth)) {
        grouped[day] = [...(grouped[day] ?? []), event]
      }

      return grouped
    },
    {}
  )
  const correctionsByDay = corrections.reduce<
    Record<string, AppliedTimeCorrection>
  >((grouped, correction) => {
    if (correction.date.startsWith(periodMonth)) {
      const current = grouped[correction.date]

      if (
        !current ||
        new Date(correction.approvedAt).getTime() >
          new Date(current.approvedAt).getTime()
      ) {
        grouped[correction.date] = correction
      }
    }

    return grouped
  }, {})

  return baseRows
    .filter((row) => row.date.startsWith(periodMonth))
    .map((row) =>
      applyCorrectionToDay(
        projectClockEventsToDay(row, eventsByDay[row.date] ?? []),
        correctionsByDay[row.date]
      )
    )
}

/**
 * Restricts rows to the part of the period that has actually happened.
 *
 * A future workday already carries a target but cannot carry worked time, so
 * summing a whole in-progress month makes the headline figures describe
 * different windows: worked stops at today while target runs to month end. On
 * the 5th of a month an employee exactly on plan still looks a hundred hours
 * short. Past periods are complete and are returned untouched.
 */
export function selectElapsedRows(
  rows: DayRow[],
  periodMonth: string,
  now = new Date()
): DayRow[] {
  if (periodMonth !== format(now, 'yyyy-MM')) return rows

  const today = format(now, 'yyyy-MM-dd')

  return rows.filter((row) => row.date <= today)
}

export function getTimesheetMetrics(rows: DayRow[]): TimesheetMetrics {
  const worked = rows.reduce((sum, row) => sum + (row.prod ?? 0), 0)
  const paid = rows.reduce((sum, row) => sum + (row.paid ?? row.total ?? 0), 0)
  const target = rows.reduce((sum, row) => sum + (row.target ?? 0), 0)
  const flex = rows.reduce((sum, row) => sum + (row.flex ?? 0), 0)
  const breaks = rows.reduce((sum, row) => sum + (row.breakTaken ?? 0), 0)

  return { breaks, flex, paid, target, worked }
}

export function buildTimesheetPayrollExport({
  approval,
  employeeId,
  employeeName,
  metrics,
  periodMonth,
  rows,
}: {
  approval: MonthlyTimesheetApproval | null
  employeeId: string
  employeeName: string
  metrics: TimesheetMetrics
  periodMonth: string
  rows: DayRow[]
}): PayrollExport {
  const labels = getExportStatusLabels()
  const buildExportStatus = (row: DayRow) =>
    [
      row.isHoliday && labels.publicHoliday,
      row.isWeekend && labels.weekend,
      row.absences.join(' '),
      row.correction && labels.corrected,
    ]
      .filter(Boolean)
      .join(EXPORT_STATUS_SEPARATOR) || labels.workday

  const exportRows = rows.map((row) => {
    return {
      breakHours: row.breakTaken ?? 0,
      date: row.date,
      flexHours: row.flex ?? 0,
      paidHours: row.paid ?? row.total ?? 0,
      status: buildExportStatus(row),
      targetHours: row.target ?? 0,
      workedHours: row.prod ?? 0,
    }
  })

  return {
    approval,
    employeeId,
    employeeName,
    exportedAt: new Date().toISOString(),
    periodMonth,
    rows: exportRows,
    totals: {
      breakHours: metrics.breaks,
      flexHours: metrics.flex,
      paidHours: metrics.paid,
      targetHours: metrics.target,
      workedHours: metrics.worked,
    },
  }
}
