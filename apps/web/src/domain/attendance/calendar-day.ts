/**
 * The calendar day a recorded instant belongs to.
 *
 * Attendance instants are stored as UTC (`new Date().toISOString()` on the
 * client, `DateTimeOffset` normalized to UTC on the server). Deciding which day
 * they belong to therefore requires an explicit rule, and the app previously
 * had two contradictory ones:
 *
 * - The timesheet grouped by `occurredAt.slice(0, 10)`, which is the UTC date.
 * - Today grouped by the browser's local date.
 *
 * For anyone east of UTC — which is all of Germany — a clock-out at 00:30 local
 * is 22:30 UTC on the previous date. Today showed it on the correct day while
 * the timesheet, the record used for payroll and audit, filed it under the day
 * before.
 *
 * The rule is now one rule, anchored on the workspace time zone. Anchoring
 * matters as much as the rule: a working-time record must describe the same day
 * to everyone who reads it. If it followed each viewer's browser instead, an
 * employee in Berlin and their manager in London would disagree about which day
 * a late shift belongs to, and a payroll export would depend on who generated
 * it. `timeZone` is optional so the browser zone remains the fallback until the
 * workspace zone is known, which keeps first paint stable.
 */

const ISO_DAY_PARTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

function toDate(instant: Date | string) {
  return instant instanceof Date ? instant : new Date(instant)
}

/**
 * Local calendar day of an instant, as `yyyy-MM-dd`.
 *
 * With no `timeZone`, resolves in the browser's zone.
 */
export function toCalendarDay(
  instant: Date | string,
  timeZone?: string
): string {
  const date = toDate(instant)

  if (Number.isNaN(date.getTime())) return ''

  if (timeZone) {
    return formatInTimeZone(date, timeZone)
  }

  // Built from local parts rather than `toISOString`, which would convert back
  // to UTC and reintroduce the very shift this exists to remove.
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Reads the day parts in an explicit zone.
 *
 * Uses `formatToParts` rather than a locale whose format happens to be
 * ISO-shaped, so the result cannot change with the user's language.
 */
function formatInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      ...ISO_DAY_PARTS,
      timeZone,
    }).formatToParts(date)
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? ''

    const year = read('year')
    const month = read('month')
    const day = read('day')

    if (!year || !month || !day) return toCalendarDay(date)

    return `${year}-${month}-${day}`
  } catch {
    // An unknown zone must not take the timesheet down. Falling back to the
    // browser zone reproduces the previous behaviour rather than inventing one.
    return toCalendarDay(date)
  }
}

/** Whether an instant falls on the same calendar day as `day`. */
export function isSameCalendarDay(
  instant: Date | string,
  day: Date,
  timeZone?: string
): boolean {
  return toCalendarDay(instant, timeZone) === toCalendarDay(day, timeZone)
}
