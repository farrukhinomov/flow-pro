import type { AttendancePolicyConfig } from '@/domain/attendance/types'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPayrollReportCsv, buildReportsPackage } from './payroll'

const user: EmployeeUser = {
  id: 'usr-report',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'report@example.com',
  firstName: 'Report',
  lastName: 'User',
  manager: 'Anna Manager',
  phoneNumber: '',
  role: 'employee',
  status: 'active',
  team: 'Operations',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  username: 'report.user',
  visibilityScope: 'Availability only',
  workPattern: 'Full-time',
}

const policy: AttendancePolicyConfig = {
  id: 'default',
  approvalRules: {
    autoApproveBookingCorrections: false,
    autoApproveBookingCorrectionThresholdMinutes: 15,
    autoApproveNonRequiredAbsences: true,
  },
  companyHolidays: [],
  countryCode: 'DE',
  defaultWeeklyHours: 40,
  defaultWorkdays: [1, 2, 3, 4, 5],
  legalBreaks: [
    { afterHours: 6, minimumMinutes: 30 },
    { afterHours: 9, minimumMinutes: 45 },
  ],
  regionCode: 'BY',
  sicknessPrivacyMode: 'manager-operational',
  updatedAt: '2026-05-01T00:00:00.000Z',
  vacationAnnualDays: 30,
  vacationCarryover: {
    enabled: true,
    expiresDay: 31,
    expiresMonth: 3,
    maxDays: 5,
  },
  periodWindows: {
    timesheet: {
      monthsBack: 24,
      monthsForward: 0,
    },
    reports: {
      monthsBack: 24,
      monthsForward: 0,
    },
    planning: {
      monthsBack: 0,
      monthsForward: 11,
    },
  },
}

describe('reports payroll package', () => {
  it('builds payroll, break compliance, absence balance, and team rows', () => {
    const report = buildReportsPackage({
      approvals: [
        {
          employeeId: user.id,
          id: `${user.id}-2026-05`,
          periodMonth: '2026-05',
          signedAt: '2026-05-31T12:00:00.000Z',
          signedById: 'manager-1',
          signedByName: 'Anna Manager',
          status: 'signed',
          updatedAt: '2026-05-31T12:00:00.000Z',
        },
      ],
      clockEvents: [
        {
          employeeId: user.id,
          id: 'clock-1',
          occurredAt: '2026-05-04T08:00:00.000Z',
          source: 'user',
          syncState: 'synced',
          type: 'clock-in',
        },
        {
          employeeId: user.id,
          id: 'clock-2',
          occurredAt: '2026-05-04T16:30:00.000Z',
          source: 'user',
          syncState: 'synced',
          type: 'clock-out',
        },
      ],
      periodMonth: '2026-05',
      policy,
      requests: [
        {
          employeeId: user.id,
          employeeName: 'Report User',
          fromDate: '2026-05-12',
          id: 'request-vac',
          kind: 'absence',
          status: 'approved',
          statusCode: 'VAC',
          statusLabel: 'Vacation',
          statusTypeId: 'vac',
          submittedAt: '2026-04-01T00:00:00.000Z',
          subtype: 'Vacation',
          syncState: 'synced',
          toDate: '2026-05-13',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      ],
      users: [user],
    })

    // 08:00 to 16:30 is eight and a half hours. Pinned because the millisecond conversion
    // was dividing by a hundredth of an hour, so every figure here came out as 850.
    const workedDay = report.employeeReports[0].days.find(
      (day) => day.date === '2026-05-04'
    )
    assert.equal(workedDay?.workedHours, 8.5)

    // One issue, not two: the day misses its § 4 break but stays inside the § 3 daily
    // maximum, which only reads correctly once the hours are in hours.
    assert.equal(report.employeeReports[0].totals.complianceIssues, 1)
    assert.equal(report.absenceBalances[0].plannedVacationDays, 2)
    assert.equal(report.teamReports[0].signedPeriods, 1)
    assert.match(buildPayrollReportCsv(report), /Break compliant/)
  })
})
