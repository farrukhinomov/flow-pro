import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import {
  foldClockEvents,
  msToHours,
} from '@/domain/attendance/clock-projection'
import type {
  AttendancePolicyConfig,
  ClockEvent,
  MonthlyTimesheetApproval,
} from '@/domain/attendance/types'
import {
  evaluateWorkingTime,
  getRequiredBreakHours,
  type WorkingTimeRule,
} from '@/domain/attendance/working-time'
import type { EmployeeRequest } from '@/domain/requests/types'
import { findGermanPublicHoliday } from '@/domain/timesheet/german-holidays'
import {
  defaultWorkContract,
  getTargetHoursForDate,
} from '@/domain/timesheet/policies'
import type { EmployeeUser } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'
import type { ReportsPackage, TeamReport } from './types'

function fullName(user: EmployeeUser) {
  return `${user.firstName} ${user.lastName}`
}
function groupClockEventsByEmployeeAndDay(events: ClockEvent[]) {
  return events.reduce<Record<string, ClockEvent[]>>((grouped, event) => {
    const key = `${event.employeeId}:${event.occurredAt.slice(0, 10)}`
    grouped[key] = [...(grouped[key] ?? []), event]
    return grouped
  }, {})
}
function getApprovedAbsenceForDay(
  employeeId: string,
  date: string,
  requests: EmployeeRequest[]
) {
  return requests.find(
    (request) =>
      request.employeeId === employeeId &&
      request.kind === 'absence' &&
      request.status === 'approved' &&
      request.fromDate <= date &&
      request.toDate >= date
  )
}
const TRANSITION_LABEL_KEYS: Record<ClockEvent['type'], string> = {
  'clock-in': 'todayUi.clockIn',
  'resume-work': 'todayUi.resumeWork',
  'start-break': 'todayUi.startBreak',
  'clock-out': 'todayUi.clockOut',
}

function projectClockEvents(events: ClockEvent[]) {
  const projection = foldClockEvents(events)
  const label = projection.transitions
    .map((transition) => {
      const time = format(parseISO(transition.occurredAt), 'HH:mm')
      const suffix =
        transition.type === 'clock-in' && transition.location === 'home-office'
          ? ` ${tStatic('common.homeOffice')}`
          : ''
      return `${tStatic(TRANSITION_LABEL_KEYS[transition.type])} ${time}${suffix}`
    })
    .join(' · ')

  return {
    breakHours: msToHours(projection.breakMs),
    label,
    workedHours: msToHours(projection.workedMs),
    // Needed to measure the ArbZG § 5 rest period against the neighbouring day.
    firstInAt: projection.firstInAt,
    lastOutAt: projection.lastOutAt,
  }
}
function countBusinessDays(fromDate: string, toDate: string) {
  return eachDayOfInterval({
    start: parseISO(`${fromDate}T12:00:00`),
    end: parseISO(`${toDate}T12:00:00`),
  }).filter((date) => {
    const day = date.getDay()
    return day !== 0 && day !== 6
  }).length
}
function getApproval(
  employeeId: string,
  periodMonth: string,
  approvals: MonthlyTimesheetApproval[]
) {
  return (
    approvals.find(
      (approval) =>
        approval.employeeId === employeeId &&
        approval.periodMonth === periodMonth
    ) ?? null
  )
}

export function buildReportsPackage({
  approvals,
  clockEvents,
  policy,
  periodMonth,
  requests,
  users,
}: {
  approvals: MonthlyTimesheetApproval[]
  clockEvents: ClockEvent[]
  policy: AttendancePolicyConfig
  periodMonth: string
  requests: EmployeeRequest[]
  users: EmployeeUser[]
}): ReportsPackage {
  const periodStart = startOfMonth(parseISO(`${periodMonth}-01T12:00:00`))
  const periodEnd = endOfMonth(periodStart)
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd })
  const eventsByEmployeeAndDay = groupClockEventsByEmployeeAndDay(clockEvents)
  const activeUsers = users.filter((user) => user.status !== 'inactive')
  const employeeReports = activeUsers.map((employee) => {
    const employeeName = fullName(employee)
    const reportDays = days.map((date) => {
      const isoDate = format(date, 'yyyy-MM-dd')
      // Scoped to the tenant's federal state: a public holiday counts toward target hours,
      // so using the nationwide set would understate them everywhere outside Berlin.
      const holiday = findGermanPublicHoliday(isoDate, policy.regionCode)
      const targetHours =
        getTargetHoursForDate(
          {
            ...defaultWorkContract,
            employeeId: employee.id,
            weeklyHours: policy.defaultWeeklyHours,
            workdays: policy.defaultWorkdays,
          },
          isoDate
        ) ?? 0
      const absence = getApprovedAbsenceForDay(employee.id, isoDate, requests)
      const projection = projectClockEvents(
        eventsByEmployeeAndDay[`${employee.id}:${isoDate}`] ?? []
      )
      // Uses the tenant's configured break policy rather than a second copy of § 4, so a
      // stricter house rule actually reaches the payroll compliance count.
      const breakRequiredHours = getRequiredBreakHours(
        projection.workedHours,
        policy.legalBreaks
      )
      const paidHours =
        projection.workedHours ||
        (absence || (holiday && targetHours) ? targetHours : 0)
      const status = [
        holiday?.name,
        absence?.statusCode ?? absence?.subtype,
        projection.label,
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        breakCompliant: projection.breakHours >= breakRequiredHours,
        breakHours: projection.breakHours,
        breakRequiredHours,
        date: isoDate,
        employeeId: employee.id,
        employeeName,
        flexHours: paidHours - targetHours,
        paidHours,
        status:
          status ||
          (targetHours
            ? tStatic('reportsUi.workdayFallback')
            : tStatic('reportsUi.nonWorkingDayFallback')),
        targetHours,
        workedHours: projection.workedHours,
        firstInAt: projection.firstInAt,
        lastOutAt: projection.lastOutAt,
      }
    })

    // § 4 is judged per day above; § 3 and § 5 need the surrounding days, so the whole month
    // is evaluated at once and the results folded back onto each date.
    const violationsByDate = evaluateWorkingTime({
      shifts: reportDays,
      breakPolicies: policy.legalBreaks,
    }).reduce((byDate, violation) => {
      byDate.set(violation.date, [
        ...(byDate.get(violation.date) ?? []),
        violation.rule,
      ])
      return byDate
    }, new Map<string, WorkingTimeRule[]>())

    const totals = reportDays.reduce(
      (sum, day) => ({
        breakHours: sum.breakHours + day.breakHours,
        complianceIssues:
          sum.complianceIssues + (violationsByDate.get(day.date)?.length ?? 0),
        flexHours: sum.flexHours + day.flexHours,
        paidHours: sum.paidHours + day.paidHours,
        targetHours: sum.targetHours + day.targetHours,
        workedHours: sum.workedHours + day.workedHours,
      }),
      {
        breakHours: 0,
        complianceIssues: 0,
        flexHours: 0,
        paidHours: 0,
        targetHours: 0,
        workedHours: 0,
      }
    )

    return {
      approval: getApproval(employee.id, periodMonth, approvals),
      days: reportDays,
      employee,
      totals,
    }
  })
  const absenceBalances = activeUsers.map((employee) => {
    const employeeRequests = requests.filter(
      (request) =>
        request.employeeId === employee.id && request.kind === 'absence'
    )
    const approvedVacationDays = employeeRequests
      .filter(
        (request) =>
          request.status === 'approved' &&
          request.statusCode === 'VAC' &&
          request.toDate < `${periodMonth}-01`
      )
      .reduce(
        (sum, request) =>
          sum + countBusinessDays(request.fromDate, request.toDate),
        0
      )
    const plannedVacationDays = employeeRequests
      .filter(
        (request) =>
          ['approved', 'submitted'].includes(request.status) &&
          request.statusCode === 'VAC' &&
          request.toDate >= `${periodMonth}-01`
      )
      .reduce(
        (sum, request) =>
          sum + countBusinessDays(request.fromDate, request.toDate),
        0
      )
    const sicknessDays = employeeRequests
      .filter((request) => request.statusCode === 'SICK')
      .reduce(
        (sum, request) =>
          sum + countBusinessDays(request.fromDate, request.toDate),
        0
      )
    const homeOfficeDays = employeeRequests
      .filter(
        (request) =>
          ['approved', 'submitted'].includes(request.status) &&
          request.statusCode === 'HO'
      )
      .reduce(
        (sum, request) =>
          sum + countBusinessDays(request.fromDate, request.toDate),
        0
      )
    return {
      annualVacationDays: policy.vacationAnnualDays,
      approvedVacationDays,
      employeeId: employee.id,
      employeeName: fullName(employee),
      homeOfficeDays,
      plannedVacationDays,
      remainingVacationDays: Math.max(
        0,
        policy.vacationAnnualDays - approvedVacationDays - plannedVacationDays
      ),
      sicknessDays,
    }
  })
  const teamReports = Array.from(
    new Set(activeUsers.map((employee) => employee.team))
  ).map((team) => {
    const teamEmployeeReports = employeeReports.filter(
      (report) => report.employee.team === team
    )
    const approvedAbsenceDays = requests
      .filter((request) => {
        const employee = activeUsers.find(
          (user) => user.id === request.employeeId
        )
        return (
          employee?.team === team &&
          request.kind === 'absence' &&
          request.status === 'approved' &&
          request.toDate >= `${periodMonth}-01` &&
          request.fromDate <= `${periodMonth}-31`
        )
      })
      .reduce(
        (sum, request) =>
          sum + countBusinessDays(request.fromDate, request.toDate),
        0
      )

    return teamEmployeeReports.reduce<TeamReport>(
      (sum, report) => ({
        ...sum,
        complianceIssues: sum.complianceIssues + report.totals.complianceIssues,
        flexHours: sum.flexHours + report.totals.flexHours,
        openPeriods:
          sum.openPeriods + (report.approval?.status === 'signed' ? 0 : 1),
        signedPeriods:
          sum.signedPeriods + (report.approval?.status === 'signed' ? 1 : 0),
        targetHours: sum.targetHours + report.totals.targetHours,
        workedHours: sum.workedHours + report.totals.workedHours,
      }),
      {
        approvedAbsenceDays,
        complianceIssues: 0,
        flexHours: 0,
        headcount: teamEmployeeReports.length,
        openPeriods: 0,
        signedPeriods: 0,
        targetHours: 0,
        team,
        workedHours: 0,
      }
    )
  })

  return {
    absenceBalances,
    employeeReports,
    generatedAt: new Date().toISOString(),
    periodMonth,
    teamReports,
  }
}
