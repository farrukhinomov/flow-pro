import { buildCsv } from '@/lib/csv'
import type { ReportsPackage } from './types'

export function buildPayrollReportCsv(report: ReportsPackage) {
  const header = [
    'Employee ID',
    'Employee',
    'Period',
    'Date',
    'Status',
    'Worked hours',
    'Paid hours',
    'Target hours',
    'Flex hours',
    'Break hours',
    'Required break hours',
    'Break compliant',
    'Approval status',
    'Signed at',
  ]
  const rows = report.employeeReports.flatMap((employeeReport) =>
    employeeReport.days.map((day) => [
      day.employeeId,
      day.employeeName,
      report.periodMonth,
      day.date,
      day.status,
      day.workedHours.toFixed(2),
      day.paidHours.toFixed(2),
      day.targetHours.toFixed(2),
      day.flexHours.toFixed(2),
      day.breakHours.toFixed(2),
      day.breakRequiredHours.toFixed(2),
      day.breakCompliant,
      employeeReport.approval?.status ?? 'open',
      employeeReport.approval?.signedAt ?? '',
    ])
  )
  return buildCsv([header, ...rows])
}

export function buildAbsenceBalanceCsv(report: ReportsPackage) {
  const header = [
    'Employee ID',
    'Employee',
    'Annual vacation days',
    'Approved vacation days',
    'Planned vacation days',
    'Remaining vacation days',
    'Sickness days',
    'Home office days',
  ]
  const rows = report.absenceBalances.map((balance) => [
    balance.employeeId,
    balance.employeeName,
    balance.annualVacationDays,
    balance.approvedVacationDays,
    balance.plannedVacationDays,
    balance.remainingVacationDays,
    balance.sicknessDays,
    balance.homeOfficeDays,
  ])
  return buildCsv([header, ...rows])
}

export function buildTeamReportCsv(report: ReportsPackage) {
  const header = [
    'Team',
    'Headcount',
    'Signed periods',
    'Open periods',
    'Worked hours',
    'Target hours',
    'Flex hours',
    'Compliance issues',
    'Approved absence days',
  ]
  const rows = report.teamReports.map((team) => [
    team.team,
    team.headcount,
    team.signedPeriods,
    team.openPeriods,
    team.workedHours.toFixed(2),
    team.targetHours.toFixed(2),
    team.flexHours.toFixed(2),
    team.complianceIssues,
    team.approvedAbsenceDays,
  ])
  return buildCsv([header, ...rows])
}
