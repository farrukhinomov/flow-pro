import { getGermanPublicHolidays } from '@/domain/timesheet/german-holidays'
import type { EmployeeUser } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
  PublicHoliday,
  ViewerRole,
  VisibilityLevel,
  WorkContract,
} from './types'

export type VacationBalanceInput = {
  annualUsedDays: number
  asOfDate: string
  carryoverDays: number
  config: AttendancePolicyConfig
}

export type VacationBalance = {
  annualDays: number
  carryoverAvailableDays: number
  carryoverExpiredDays: number
  entitlementDays: number
  remainingDays: number
}

export type PolicyRuleCheck = {
  id: string
  severity: 'info' | 'warning' | 'block'
  title: string
  message: string
}

export function buildHolidayCalendar({
  config,
  year,
}: {
  config: AttendancePolicyConfig
  year: number
}): PublicHoliday[] {
  // Derived per year and per federal state. This used to filter a hardcoded 2026 list by
  // year prefix, so every other year produced an empty calendar, and the state was applied
  // to company holidays only — an employee in Bayern and one in Berlin got the same
  // statutory set even though the two states do not observe the same days.
  const statutory =
    config.countryCode === 'DE'
      ? getGermanPublicHolidays(year, config.regionCode)
      : []
  const company = config.companyHolidays
    .filter((holiday) => holiday.date.startsWith(`${year}-`))
    .map<PublicHoliday>((holiday) => ({
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      region: config.regionCode,
      source: 'policy',
    }))

  return [...statutory, ...company].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildDefaultWorkContract({
  config,
  employee,
}: {
  config: AttendancePolicyConfig
  employee: EmployeeUser
}): WorkContract {
  const workdays = inferWorkdays(employee.workPattern, config.defaultWorkdays)
  const weeklyHours = inferWeeklyHours(
    employee.workPattern,
    config.defaultWeeklyHours
  )
  const dailyHours = Object.fromEntries(
    workdays.map((weekday) => [weekday, weeklyHours / workdays.length])
  )

  return {
    id: `contract-${employee.id}-policy-default`,
    employeeId: employee.id,
    effectiveFrom: employee.createdAt.toISOString().slice(0, 10),
    weeklyHours,
    workdays,
    dailyHours,
  }
}

export function calculateVacationBalance({
  annualUsedDays,
  asOfDate,
  carryoverDays,
  config,
}: VacationBalanceInput): VacationBalance {
  const carryoverAvailableDays = getCarryoverAvailableDays({
    asOfDate,
    carryoverDays,
    config,
  })
  const entitlementDays = config.vacationAnnualDays + carryoverAvailableDays
  const remainingDays = Math.max(0, entitlementDays - annualUsedDays)

  return {
    annualDays: config.vacationAnnualDays,
    carryoverAvailableDays,
    carryoverExpiredDays: Math.max(0, carryoverDays - carryoverAvailableDays),
    entitlementDays,
    remainingDays,
  }
}

export function getPolicyVisibility({
  config,
  statusType,
  viewerRole,
}: {
  config: AttendancePolicyConfig
  statusType: AttendanceStatusType
  viewerRole: ViewerRole
}): VisibilityLevel {
  if (
    statusType.category === 'sickness' &&
    config.sicknessPrivacyMode === 'medical-confidential'
  ) {
    if (viewerRole === 'admin') return 'full'
    if (viewerRole === 'employee') return 'full'
    if (viewerRole === 'manager') return 'state-only'
    return 'hidden'
  }

  if (viewerRole === 'admin') return statusType.adminVisibility
  if (viewerRole === 'manager') return statusType.managerVisibility
  if (viewerRole === 'employee') return 'full'

  return statusType.teammateVisibility
}

export function evaluatePolicyRules({
  balance,
  config,
  requestedDays,
  statusType,
}: {
  balance?: VacationBalance
  config: AttendancePolicyConfig
  requestedDays: number
  statusType: AttendanceStatusType
}): PolicyRuleCheck[] {
  const checks: PolicyRuleCheck[] = []

  if (statusType.category === 'leave' && balance) {
    if (requestedDays > balance.remainingDays) {
      checks.push({
        id: 'vacation-balance',
        severity: 'block',
        title: tStatic('attendanceUi.vacationBalanceExceededTitle'),
        message: tStatic('attendanceUi.vacationBalanceExceededMessage', {
          requestedDays,
          remainingDays: balance.remainingDays,
        }),
      })
    }

    if (balance.carryoverExpiredDays > 0) {
      checks.push({
        id: 'carryover-expired',
        severity: 'warning',
        title: tStatic('attendanceUi.carryoverExpiredTitle'),
        message: tStatic('attendanceUi.carryoverExpiredMessage', {
          carryoverExpiredDays: balance.carryoverExpiredDays,
        }),
      })
    }
  }

  if (
    statusType.category === 'sickness' &&
    config.sicknessPrivacyMode === 'medical-confidential'
  ) {
    checks.push({
      id: 'sickness-privacy',
      severity: 'info',
      title: tStatic('attendanceUi.sicknessPrivacyEnforcedTitle'),
      message: tStatic('attendanceUi.sicknessPrivacyEnforcedMessage'),
    })
  }

  return checks
}

function getCarryoverAvailableDays({
  asOfDate,
  carryoverDays,
  config,
}: {
  asOfDate: string
  carryoverDays: number
  config: AttendancePolicyConfig
}) {
  if (!config.vacationCarryover.enabled) return 0

  const cappedCarryover = Math.min(
    carryoverDays,
    config.vacationCarryover.maxDays
  )
  const asOf = new Date(`${asOfDate}T12:00:00`)
  const expiry = new Date(
    asOf.getFullYear(),
    config.vacationCarryover.expiresMonth - 1,
    config.vacationCarryover.expiresDay,
    23,
    59,
    59
  )

  return asOf.getTime() <= expiry.getTime() ? cappedCarryover : 0
}

function inferWeeklyHours(workPattern: string, fallback: number) {
  const match = workPattern.match(/(\d+(?:[.,]\d+)?)\s*h/i)

  if (!match) return fallback

  return Number(match[1].replace(',', '.')) || fallback
}

function inferWorkdays(workPattern: string, fallback: number[]) {
  const normalized = workPattern.toLowerCase()

  if (normalized.includes('mon-wed')) return [1, 2, 3]
  if (normalized.includes('mon-thu')) return [1, 2, 3, 4]
  if (normalized.includes('weekend')) return [0, 6]

  return fallback
}
