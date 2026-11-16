import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import type { EmployeeUser } from '@/domain/users/types'

export type PayrollReportDay = {
  date: string
  employeeId: string
  employeeName: string
  status: string
  workedHours: number
  paidHours: number
  targetHours: number
  flexHours: number
  breakHours: number
  breakRequiredHours: number
  breakCompliant: boolean
}

export type EmployeePayrollReport = {
  employee: EmployeeUser
  approval: MonthlyTimesheetApproval | null
  days: PayrollReportDay[]
  totals: {
    workedHours: number
    paidHours: number
    targetHours: number
    flexHours: number
    breakHours: number
    complianceIssues: number
  }
}

export type AbsenceBalanceReport = {
  employeeId: string
  employeeName: string
  annualVacationDays: number
  approvedVacationDays: number
  plannedVacationDays: number
  remainingVacationDays: number
  sicknessDays: number
  homeOfficeDays: number
}

export type TeamReport = {
  team: string
  headcount: number
  signedPeriods: number
  openPeriods: number
  workedHours: number
  targetHours: number
  flexHours: number
  complianceIssues: number
  approvedAbsenceDays: number
}

export type ReportsPackage = {
  periodMonth: string
  generatedAt: string
  employeeReports: EmployeePayrollReport[]
  absenceBalances: AbsenceBalanceReport[]
  teamReports: TeamReport[]
}

export type PayrollExportRecord = {
  id: string
  period: string
  format: 'DATEV' | 'Excel' | 'Personio'
  scope?: string
  status: 'ready' | 'processing' | 'failed'
  requestedByUserId: string
  requestedByName: string
  createdAt: string
  updatedAt: string
  syncState?: 'synced' | 'pending' | 'failed' | 'conflict'
}
