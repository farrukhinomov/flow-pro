import type { WeekStart } from '@/domain/users/preferences'

/**
 * Where a week begins, in `Date.getDay()` terms.
 *
 * The app carried two hardcoded and contradictory answers: the timesheet
 * started weeks on Monday, while the planning year calendar laid its grid out
 * Sunday-first. The account setting that claims to control this governed
 * neither.
 *
 * Monday is the default because FlowPro is a German-market product and ISO 8601
 * weeks start on Monday, which is what the calendar-week numbers shown in
 * planning already assume.
 */
const WEEK_START_DAY: Record<WeekStart, number> = {
  monday: 1,
  sunday: 0,
}

export function weekStartDay(weekStart: WeekStart) {
  return WEEK_START_DAY[weekStart] ?? WEEK_START_DAY.monday
}

/**
 * Days to subtract from `date` to reach the first day of its week.
 *
 * Always zero or negative, so callers add it.
 */
export function weekStartOffset(date: Date, weekStart: WeekStart) {
  const daysSinceStart = (date.getDay() - weekStartDay(weekStart) + 7) % 7

  // Negating zero would yield -0, which is not strictly equal to 0 and would
  // surprise any caller comparing the result.
  return daysSinceStart === 0 ? 0 : -daysSinceStart
}

/**
 * Weekday name keys ordered for the configured week start.
 *
 * `names` is indexed by `Date.getDay()`, so it always begins at Sunday; this
 * rotates it for rendering without the caller re-deriving the order.
 */
export function orderedWeekdays<T>(names: readonly T[], weekStart: WeekStart) {
  const start = weekStartDay(weekStart)

  return names.map((_, index) => names[(index + start) % names.length])
}

/**
 * Blank cells before the first of the month in a week-aligned grid.
 */
export function leadingBlankDays(monthStart: Date, weekStart: WeekStart) {
  return (monthStart.getDay() - weekStartDay(weekStart) + 7) % 7
}
