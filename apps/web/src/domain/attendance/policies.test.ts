import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  emptyAttendanceTypeDraft,
  getDefaultAttendancePolicyConfig,
  getDefaultAttendanceTypes,
} from './policies'

describe('attendance policy defaults', () => {
  it('defines the core status types used across requests and planning', () => {
    const updatedAt = '2026-05-24T08:00:00.000Z'
    const types = getDefaultAttendanceTypes(updatedAt)
    const byCode = new Map(types.map((type) => [type.code, type]))

    assert.deepEqual(
      types.map((type) => type.code),
      ['HO', 'VAC', 'OFF', 'SICK']
    )
    assert.equal(byCode.get('HO')?.category, 'remote')
    assert.equal(byCode.get('VAC')?.requiresApproval, true)
    assert.equal(byCode.get('OFF')?.requiresApproval, false)
    assert.equal(byCode.get('SICK')?.teammateVisibility, 'hidden')
    assert.equal(
      types.every((type) => type.updatedAt === updatedAt),
      true
    )
  })

  it('keeps company policy defaults explicit and privacy-first', () => {
    const updatedAt = '2026-05-24T08:00:00.000Z'
    const config = getDefaultAttendancePolicyConfig(updatedAt)

    assert.equal(config.countryCode, 'DE')
    assert.deepEqual(config.defaultWorkdays, [1, 2, 3, 4, 5])
    assert.equal(config.defaultWeeklyHours, 40)
    assert.equal(config.vacationAnnualDays, 30)
    assert.equal(config.sicknessPrivacyMode, 'medical-confidential')
    assert.deepEqual(config.legalBreaks, [
      { afterHours: 6, minimumMinutes: 30 },
      { afterHours: 9, minimumMinutes: 45 },
    ])
    assert.equal(config.updatedAt, updatedAt)
  })

  it('starts custom status drafts with safe visibility defaults', () => {
    assert.equal(emptyAttendanceTypeDraft.category, 'custom')
    assert.equal(emptyAttendanceTypeDraft.teammateVisibility, 'state-only')
    assert.equal(emptyAttendanceTypeDraft.managerVisibility, 'operational')
    assert.equal(emptyAttendanceTypeDraft.adminVisibility, 'full')
    assert.equal(emptyAttendanceTypeDraft.auditRequired, true)
  })
})
