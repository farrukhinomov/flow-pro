import type { Locale } from '@/i18n'
import { formatLocaleDate, formatLocaleNumber } from '@/i18n/format'
import { parsePeriodMonth } from '@/lib/periods'
import { EMPTY_VALUE } from '@/lib/utils'
import type { DayRow } from './types'

/**
 * Display formatting for the timesheet: durations, clock times, and the date
 * parts the ledger and day headers render.
 *
 * Split out of `timesheet-view-model.ts` because these are the pieces reused by
 * the ledger, the day chart, the summary widgets, and the export builder, and
 * because none of them touch row construction.
 */

function decimalToMinutes(value: number) {
  return Math.round(Math.abs(value) * 60)
}

export function formatHours(
  value?: number,
  industrial = true,
  locale: Locale = 'en'
) {
  if (value === undefined || value === null) return EMPTY_VALUE

  const sign = value < 0 ? '-' : value > 0 ? '+' : ''

  if (industrial) {
    return `${sign}${formatLocaleNumber(Math.abs(value), locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const minutes = decimalToMinutes(value)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return `${sign}${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatNeutralHours(
  value?: number,
  industrial = true,
  locale: Locale = 'en'
) {
  if (value === undefined || value === null) return EMPTY_VALUE

  if (industrial)
    return formatLocaleNumber(value, locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const minutes = decimalToMinutes(value)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function timeToMinutes(value?: string) {
  const match = value?.match(/^(\d{2}):(\d{2})/)

  if (!match) return undefined

  return Number(match[1]) * 60 + Number(match[2])
}

export function cleanTime(value?: string) {
  return value?.slice(0, 5) ?? ''
}

export function getDayParts(row: DayRow, locale: Locale = 'en') {
  const date = new Date(`${row.date}T12:00:00`)

  return {
    day: formatLocaleDate(date, locale, { day: '2-digit' }),
    month: formatLocaleDate(date, locale, { month: 'short' }),
    weekday: formatLocaleDate(date, locale, { weekday: 'short' }),
  }
}

export function getPeriodParts(period: string, locale: Locale = 'en') {
  const date = parsePeriodMonth(period)

  return {
    month: period,
    label: formatLocaleDate(date, locale, {
      month: 'long',
      year: 'numeric',
    }),
  }
}
