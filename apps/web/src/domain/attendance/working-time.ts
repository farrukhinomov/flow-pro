import type { BreakPolicy } from './types'

/**
 * Working-time limits from the Arbeitszeitgesetz.
 *
 * These were previously spread across the codebase: the break thresholds existed both as a
 * configurable policy and as a second hardcoded copy inside the payroll builder, while the
 * daily maximum and the rest period were not checked at all. Keeping the statute in one
 * module means a rule can only be wrong in one place.
 */

/** ArbZG § 3: eight hours a day, extendable to ten when averaged back down over six months. */
export const ARBZG_STANDARD_DAILY_HOURS = 8
export const ARBZG_MAX_DAILY_HOURS = 10

/** ArbZG § 5: eleven uninterrupted hours between the end of one shift and the start of the next. */
export const ARBZG_MIN_REST_HOURS = 11

/** ArbZG § 4: 30 minutes over six hours worked, 45 minutes over nine. */
export const STATUTORY_BREAK_POLICY: readonly BreakPolicy[] = [
  { afterHours: 6, minimumMinutes: 30 },
  { afterHours: 9, minimumMinutes: 45 },
]

/**
 * Minimum break a shift of this length must contain, in minutes.
 *
 * The thresholds are exclusive: § 4 requires a break for work of *more than* six hours, so a
 * shift of exactly six needs none.
 */
export function getRequiredBreakMinutes(
  workedHours: number,
  breakPolicies: readonly BreakPolicy[] = STATUTORY_BREAK_POLICY
): number {
  return breakPolicies
    .filter((policy) => workedHours > policy.afterHours)
    .reduce((longest, policy) => Math.max(longest, policy.minimumMinutes), 0)
}

export function getRequiredBreakHours(
  workedHours: number,
  breakPolicies: readonly BreakPolicy[] = STATUTORY_BREAK_POLICY
): number {
  return getRequiredBreakMinutes(workedHours, breakPolicies) / 60
}

export type WorkingTimeRule = 'break' | 'max-daily-hours' | 'rest-period'

export type WorkingTimeViolation = {
  date: string
  rule: WorkingTimeRule
  /** Hours actually recorded for the rule in question. */
  actualHours: number
  /** Hours the statute requires, or permits at most. */
  requiredHours: number
}

export type WorkingTimeShift = {
  date: string
  workedHours: number
  breakHours: number
  /** ISO timestamps. Omitted where a day has no recorded clock pair. */
  firstInAt?: string
  lastOutAt?: string
}

/**
 * Working-time violations across a sequence of days.
 *
 * Shifts may arrive in any order and need not be contiguous; the rest-period check compares
 * each shift with the one that actually precedes it, so a gap in the data cannot manufacture
 * a violation.
 */
export function evaluateWorkingTime({
  shifts,
  breakPolicies = STATUTORY_BREAK_POLICY,
  maxDailyHours = ARBZG_MAX_DAILY_HOURS,
  minRestHours = ARBZG_MIN_REST_HOURS,
}: {
  shifts: readonly WorkingTimeShift[]
  breakPolicies?: readonly BreakPolicy[]
  maxDailyHours?: number
  minRestHours?: number
}): WorkingTimeViolation[] {
  const ordered = [...shifts].sort((a, b) => a.date.localeCompare(b.date))
  const violations: WorkingTimeViolation[] = []

  ordered.forEach((shift, index) => {
    const requiredBreakHours = getRequiredBreakHours(
      shift.workedHours,
      breakPolicies
    )

    if (shift.breakHours < requiredBreakHours) {
      violations.push({
        date: shift.date,
        rule: 'break',
        actualHours: shift.breakHours,
        requiredHours: requiredBreakHours,
      })
    }

    if (shift.workedHours > maxDailyHours) {
      violations.push({
        date: shift.date,
        rule: 'max-daily-hours',
        actualHours: shift.workedHours,
        requiredHours: maxDailyHours,
      })
    }

    // Rest is measured from the previous shift's last clock-out to this shift's first
    // clock-in, so a day without a recorded pair simply cannot be judged.
    const previous = ordered[index - 1]
    if (!previous?.lastOutAt || !shift.firstInAt) return

    const restHours =
      (new Date(shift.firstInAt).getTime() -
        new Date(previous.lastOutAt).getTime()) /
      3_600_000

    if (restHours >= 0 && restHours < minRestHours) {
      violations.push({
        date: shift.date,
        rule: 'rest-period',
        actualHours: restHours,
        requiredHours: minRestHours,
      })
    }
  })

  return violations
}
