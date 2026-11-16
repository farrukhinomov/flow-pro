import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getDefaultAttendancePolicyConfig,
  getDefaultAttendanceTypes,
} from './policies'
import {
  buildDefaultWorkContract,
  buildHolidayCalendar,
  calculateVacationBalance,
  evaluatePolicyRules,
  getPolicyVisibility,
} from './policy-engine'

const config = getDefaultAttendancePolicyConfig('2026-05-24T00:00:00.000Z')
const vacationType = getDefaultAttendanceTypes()[1]
const sickType = getDefaultAttendanceTypes()[3]
const employee: EmployeeUser = {
  id: 'usr-sophie',
  firstName: 'Sophie',
  lastName: 'Mann',
  username: 'sophie.mann',
  email: 'sophie@flowpro.dev',
  phoneNumber: '',
  status: 'active',
  role: 'employee',
  team: 'Support',
  manager: 'Anna Queen',
  workPattern: 'Part-time · Mon-Wed',
  visibilityScope: 'Availability only',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('attendance policy engine', () => {
  it('combines country and company holidays', () => {
    const holidays = buildHolidayCalendar({ config, year: 2026 })

    assert.equal(
      holidays.some((holiday) => holiday.date === '2026-05-01'),
      true
    )
    assert.equal(
      holidays.some((holiday) => holiday.date === '2026-12-24'),
      true
    )
  })

  it('derives a working-time model from employee work patterns', () => {
    const contract = buildDefaultWorkContract({ config, employee })

    assert.deepEqual(contract.workdays, [1, 2, 3])
    assert.equal(contract.weeklyHours, 40)
  })

  it('expires carryover after the configured date', () => {
    const balance = calculateVacationBalance({
      annualUsedDays: 5,
      asOfDate: '2026-04-01',
      carryoverDays: 8,
      config,
    })

    assert.equal(balance.carryoverAvailableDays, 0)
    assert.equal(balance.carryoverExpiredDays, 8)
    assert.equal(balance.remainingDays, 25)
  })

  it('enforces confidential sickness visibility', () => {
    assert.equal(
      getPolicyVisibility({
        config,
        statusType: sickType,
        viewerRole: 'teammate',
      }),
      'hidden'
    )
    assert.equal(
      getPolicyVisibility({
        config,
        statusType: sickType,
        viewerRole: 'manager',
      }),
      'state-only'
    )
  })

  it('blocks vacation requests that exceed available balance', () => {
    const balance = calculateVacationBalance({
      annualUsedDays: 28,
      asOfDate: '2026-02-01',
      carryoverDays: 0,
      config,
    })
    const checks = evaluatePolicyRules({
      balance,
      config,
      requestedDays: 4,
      statusType: vacationType,
    })

    assert.equal(
      checks.some((check) => check.severity === 'block'),
      true
    )
  })
})
