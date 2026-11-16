import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deactivateEmployeeUserRecord,
  getLifecycleSummary,
  reactivateEmployeeUserRecord,
} from './lifecycle'
import type { EmployeeUser } from './types'

const user: EmployeeUser = {
  id: 'usr-leaver',
  firstName: 'Lee',
  lastName: 'Aver',
  username: 'lee.aver',
  email: 'lee.aver@flowpro.dev',
  phoneNumber: '',
  status: 'active',
  role: 'employee',
  team: 'Operations',
  manager: 'Anna Queen',
  workPattern: 'Full-time',
  visibilityScope: 'Availability only',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('user lifecycle', () => {
  it('deactivates a user without deleting historical identity', () => {
    const now = new Date('2026-05-24T08:00:00.000Z')
    const next = deactivateEmployeeUserRecord({
      actorId: 'usr-admin',
      now,
      reason: 'Employment ended',
      user,
    })

    assert.equal(next.id, user.id)
    assert.equal(next.status, 'inactive')
    assert.equal(next.deactivatedBy, 'usr-admin')
    assert.equal(next.deactivationReason, 'Employment ended')
    assert.equal(next.retentionUntil?.getFullYear(), 2033)
  })

  it('reactivates a user and clears deactivation metadata', () => {
    const inactive = deactivateEmployeeUserRecord({ user })
    const active = reactivateEmployeeUserRecord(
      inactive,
      new Date('2026-05-25T08:00:00.000Z')
    )

    assert.equal(active.status, 'active')
    assert.equal(active.deactivatedAt, undefined)
    assert.equal(active.retentionUntil, undefined)
  })

  describe('getLifecycleSummary', () => {
    // The summary must stay a translation key: it renders in the directory
    // table and the user drawer, both of which are localized.
    it('returns the retention key with the raw date for inactive users', () => {
      const inactive = deactivateEmployeeUserRecord({
        now: new Date('2026-05-24T08:00:00.000Z'),
        user,
      })
      const summary = getLifecycleSummary(inactive)

      assert.equal(summary.key, 'usersUi.lifecycle.retention')
      assert.equal(summary.retentionUntil?.getFullYear(), 2033)
    })

    it('maps each remaining status to its own key', () => {
      assert.equal(
        getLifecycleSummary({ ...user, status: 'suspended' }).key,
        'usersUi.lifecycle.suspended'
      )
      assert.equal(
        getLifecycleSummary({ ...user, status: 'invited' }).key,
        'usersUi.lifecycle.invited'
      )
      assert.equal(getLifecycleSummary(user).key, 'usersUi.lifecycle.active')
    })

    it('carries no date when there is nothing to retain', () => {
      assert.equal(getLifecycleSummary(user).retentionUntil, undefined)
    })
  })
})
