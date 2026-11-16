import { addMonths, subMonths } from 'date-fns'
import type { PeriodWindowPolicy } from '@/domain/attendance/types'

export function resolvePeriodWindowBounds(
  anchorDate: Date,
  policy: PeriodWindowPolicy
) {
  return {
    min: subMonths(anchorDate, Math.max(policy.monthsBack - 1, 0)),
    max: addMonths(anchorDate, Math.max(policy.monthsForward, 0)),
  }
}
