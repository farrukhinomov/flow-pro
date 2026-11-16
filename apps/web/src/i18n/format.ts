import type { Locale } from './messages'

/**
 * Maps a FlowPro locale to the BCP 47 tag used for formatting.
 *
 * `en` deliberately resolves to `en-GB` rather than `en-US`. FlowPro is a
 * German-market product whose English surface is read by European users, and
 * every date in the product was day-first before these helpers existed.
 * Resolving to `en-US` would silently flip `04/05/2026` from 4 May to 5 April.
 */
const LOCALE_TAGS: Record<Locale, string> = {
  de: 'de-DE',
  en: 'en-GB',
}

export function localeTag(locale: Locale) {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.en
}

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value)
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime())
}

/**
 * Constructed per call on purpose.
 *
 * An earlier version of this file memoized formatters in a `Map` keyed by
 * `JSON.stringify(options)`. That made the Reports page roughly six times
 * slower (~4s to ~25s to first paint with a full tenant's data): V8 already
 * memoizes `Intl` constructors for equivalent arguments, so the lookup key was
 * pure added cost on a path called once per table cell.
 *
 * Named helpers below that have fixed options use {@link cachedFormatter},
 * which keys on a literal string and never serializes anything.
 */
function dateTimeFormatter(
  locale: Locale,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(localeTag(locale), options)
}

function numberFormatter(locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeTag(locale), options)
}

/**
 * Formatter cache for the fixed-shape helpers.
 *
 * Safe to cache because each caller passes a constant `kind` alongside constant
 * options, so the key is two string concatenations rather than a serialization
 * of the options object.
 */
const fixedFormatters = new Map<string, Intl.DateTimeFormat>()

function cachedFormatter(
  kind: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
) {
  const tag = localeTag(locale)
  const key = `${kind}|${tag}`
  let formatter = fixedFormatters.get(key)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, options)
    fixedFormatters.set(key, formatter)
  }

  return formatter
}

function formatFixed(
  kind: string,
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
) {
  const date = toDate(value)

  if (!isValidDate(date)) return ''

  return cachedFormatter(kind, locale, options).format(date)
}

export function formatLocaleDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
) {
  const date = toDate(value)

  if (!isValidDate(date)) return ''

  return dateTimeFormatter(locale, options).format(date)
}

export function formatLocaleNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
) {
  return numberFormatter(locale, options).format(value)
}

/** Numeric date: `04/05/2026` (en-GB) or `04.05.2026` (de-DE). */
export function formatShortDate(value: Date | string | number, locale: Locale) {
  return formatFixed('short-date', value, locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Readable date: `4 May 2026` (en-GB) or `4. Mai 2026` (de-DE). */
export function formatMediumDate(
  value: Date | string | number,
  locale: Locale
) {
  return formatFixed('medium-date', value, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Day and month only: `4 May` / `4. Mai`. Used in calendar and range headers. */
export function formatDayMonth(value: Date | string | number, locale: Locale) {
  return formatFixed('day-month', value, locale, {
    day: 'numeric',
    month: 'short',
  })
}

/** Wall-clock time in 24-hour form, which both supported locales use. */
export function formatTime(value: Date | string | number, locale: Locale) {
  return formatFixed('time', value, locale, {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  })
}

/** Date and time together, for audit rows and event timelines. */
export function formatDateTime(value: Date | string | number, locale: Locale) {
  return formatFixed('date-time', value, locale, {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Month and year: `May 2026` / `Mai 2026`. */
export function formatMonthYear(value: Date | string | number, locale: Locale) {
  return formatFixed('month-year', value, locale, {
    month: 'long',
    year: 'numeric',
  })
}

/** Standalone weekday name, e.g. `Mon` / `Mo`. */
export function formatWeekday(
  value: Date | string | number,
  locale: Locale,
  weekday: Intl.DateTimeFormatOptions['weekday'] = 'short'
) {
  return formatLocaleDate(value, locale, { weekday })
}

/**
 * Inclusive date range. Collapses to a single date when both ends match, so
 * one-day absences do not render as "4 May 2026 - 4 May 2026".
 */
export function formatDateRange(
  from: Date | string | number,
  to: Date | string | number,
  locale: Locale
) {
  const fromLabel = formatShortDate(from, locale)
  const toLabel = formatShortDate(to, locale)

  return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`
}

const RELATIVE_UNITS: readonly {
  unit: Intl.RelativeTimeFormatUnit
  ms: number
}[] = [
  { ms: 1000 * 60 * 60 * 24 * 365, unit: 'year' },
  { ms: 1000 * 60 * 60 * 24 * 30, unit: 'month' },
  { ms: 1000 * 60 * 60 * 24 * 7, unit: 'week' },
  { ms: 1000 * 60 * 60 * 24, unit: 'day' },
  { ms: 1000 * 60 * 60, unit: 'hour' },
  { ms: 1000 * 60, unit: 'minute' },
]

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()

/**
 * Locale-aware "2 hours ago" / "vor 2 Stunden".
 *
 * Replaces `date-fns` `formatDistanceToNow`, which was always called without a
 * `locale` option and therefore rendered English to German users on every
 * screen that showed a last-synced or last-seen timestamp.
 */
export function formatRelativeTime(
  value: Date | string | number,
  locale: Locale,
  now: Date = new Date()
) {
  const date = toDate(value)

  if (!isValidDate(date)) return ''

  const tag = localeTag(locale)
  let formatter = relativeFormatters.get(tag)

  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' })
    relativeFormatters.set(tag, formatter)
  }

  const deltaMs = date.getTime() - now.getTime()
  const absMs = Math.abs(deltaMs)

  for (const { ms, unit } of RELATIVE_UNITS) {
    if (absMs >= ms) {
      return formatter.format(Math.round(deltaMs / ms), unit)
    }
  }

  return formatter.format(Math.round(deltaMs / 1000), 'second')
}
