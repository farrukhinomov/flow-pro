import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from 'date-fns'
import type { PlanningEntry, PlanningPerson } from '@/domain/planning/types'
import { findGermanPublicHoliday } from '@/domain/timesheet/german-holidays'
import { tStatic } from '@/i18n/static'
import { buildCsv } from '@/lib/csv'

export type PlanningAbsenceStyle = {
  label?: string
  labelKey: string
  className: string
  short: string
}

export const absenceStyles: Record<string, PlanningAbsenceStyle> = {
  HO: {
    labelKey: 'planningUi.absenceLabels.homeOffice',
    short: 'HO',
    className: 'bg-fuchsia-500 text-white',
  },
  URL: {
    labelKey: 'planningUi.absenceLabels.vacation',
    short: 'VAC',
    className: 'bg-emerald-500 text-white',
  },
  KR: {
    labelKey: 'planningUi.absenceLabels.sickLeave',
    short: 'SICK',
    className: 'bg-amber-500 text-white',
  },
  AZ: {
    labelKey: 'planningUi.absenceLabels.timeOff',
    short: 'OFF',
    className: 'bg-slate-500 text-white',
  },
  OFF: {
    labelKey: 'planningUi.absenceLabels.unavailable',
    short: 'OFF',
    className: 'bg-slate-500 text-white',
  },
  VAC: {
    labelKey: 'planningUi.absenceLabels.vacation',
    short: 'VAC',
    className: 'bg-emerald-500 text-white',
  },
  SICK: {
    labelKey: 'planningUi.absenceLabels.sickLeave',
    short: 'SICK',
    className: 'bg-amber-500 text-white',
  },
}

/**
 * Name of the statutory holiday on a date, or undefined. Derived from the date's year rather
 * than read from a fixed table, so the planning calendar keeps working past 2026.
 */
export function getPublicHolidayName(isoDate: string) {
  return findGermanPublicHoliday(isoDate)?.name
}

export const dayNames = [
  'common.sunday',
  'attendanceUi.monday',
  'attendanceUi.tuesday',
  'attendanceUi.wednesday',
  'attendanceUi.thursday',
  'attendanceUi.friday',
  'attendanceUi.saturday',
] as const

export type PlanningDayKind = 'weekday' | 'weekend' | 'holiday'

const REMOTE_CODES = new Set(['HO'])
const LEAVE_CODES = new Set(['URL', 'VAC'])
const DEFAULT_PLANNING_CATEGORY = 'available'

function getPlanningCsvHeader() {
  return [
    tStatic('planningUi.csvHeaders.date'),
    tStatic('planningUi.csvHeaders.employee'),
    tStatic('planningUi.csvHeaders.team'),
    tStatic('planningUi.csvHeaders.role'),
    tStatic('planningUi.csvHeaders.dayType'),
    tStatic('planningUi.csvHeaders.statusCode'),
    tStatic('planningUi.csvHeaders.status'),
    tStatic('planningUi.csvHeaders.category'),
    tStatic('planningUi.csvHeaders.pending'),
    tStatic('planningUi.csvHeaders.confidential'),
    tStatic('planningUi.csvHeaders.holiday'),
  ] as const
}

export type PlanningStats = {
  remoteDays: number
  leaveDays: number
  pending: number
  confidential: number
  conflicts: number
}

export function getDayKind(date: Date): PlanningDayKind {
  const iso = format(date, 'yyyy-MM-dd')
  if (getPublicHolidayName(iso)) return 'holiday'

  const day = getDay(date)
  if (day === 0 || day === 6) return 'weekend'

  return 'weekday'
}

export function getEntryMap(person: PlanningPerson) {
  return new Map(person.entries.map((entry) => [entry.date, entry]))
}

export function getAbsenceStyle(entry?: PlanningEntry): PlanningAbsenceStyle {
  if (!entry?.code) {
    return {
      labelKey: 'planningUi.absenceLabels.unavailable',
      label: '',
      short: '',
      className: 'bg-muted text-muted-foreground',
    }
  }

  return (
    absenceStyles[entry.code] ?? {
      labelKey: '',
      label:
        entry.label ??
        tStatic('planningUi.fallbackStatus', { code: entry.code }),
      short: entry.code,
      className: 'bg-blue-500 text-white',
    }
  )
}

export function getPlanningStats({
  conflictCount,
  month,
  people,
}: {
  conflictCount: number
  month: Date
  people: PlanningPerson[]
}): PlanningStats {
  const currentMonth = format(month, 'yyyy-MM')
  const monthEntries = people.flatMap((person) =>
    person.entries
      .filter((entry) => entry.date.startsWith(currentMonth))
      .map((entry) => ({ ...entry, personId: person.id }))
  )

  return {
    remoteDays: monthEntries.filter(
      (entry) =>
        REMOTE_CODES.has(entry.code ?? '') || entry.category === 'remote'
    ).length,
    leaveDays: monthEntries.filter(
      (entry) => LEAVE_CODES.has(entry.code ?? '') || entry.category === 'leave'
    ).length,
    pending: monthEntries.filter((entry) => entry.isPending).length,
    confidential: monthEntries.filter((entry) => entry.isAnon).length,
    conflicts: conflictCount,
  }
}

export function buildPlanningCsv({
  month,
  people,
}: {
  month: Date
  people: PlanningPerson[]
}) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  })
  const rows = people.flatMap((person) => {
    const entries = getEntryMap(person)

    return days.map((day) => {
      const date = format(day, 'yyyy-MM-dd')
      const entry = entries.get(date)

      return [
        date,
        person.name,
        person.team,
        person.role,
        getDayKind(day),
        entry?.code ?? '',
        entry?.label ?? '',
        entry?.category ?? DEFAULT_PLANNING_CATEGORY,
        entry?.isPending ?? false,
        entry?.isAnon ?? false,
        getPublicHolidayName(date) ?? '',
      ]
    })
  })

  return buildCsv([getPlanningCsvHeader(), ...rows])
}

export type PlanningDayMeta = {
  date: Date
  holidayName?: string
  iso: string
  kind: PlanningDayKind
}

/**
 * Precomputes the ISO key, day kind, and holiday name for a run of days.
 *
 * The month grids used to derive all three inside the per-person, per-day cell
 * loop, so a 20-person month recomputed them ~620 times each — roughly 1,800
 * `format` calls and 620 holiday lookups on every render. The values depend
 * only on the date, so they are computed once per day and shared across rows.
 */
export function buildPlanningDayMeta(days: Date[]): PlanningDayMeta[] {
  return days.map((date) => {
    const iso = format(date, 'yyyy-MM-dd')
    const holidayName = getPublicHolidayName(iso)
    const weekday = getDay(date)

    return {
      date,
      holidayName,
      iso,
      kind: holidayName
        ? 'holiday'
        : weekday === 0 || weekday === 6
          ? 'weekend'
          : 'weekday',
    }
  })
}
