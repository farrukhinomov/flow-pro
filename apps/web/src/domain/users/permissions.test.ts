import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getEffectivePermissions,
  hasPermission,
  rolePermissions,
} from './permissions'
import type { EmployeeUser } from './types'

const baseUser: EmployeeUser = {
  id: 'usr-test',
  firstName: 'Test',
  lastName: 'User',
  username: 'test.user',
  email: 'test.user@flowpro.dev',
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

describe('user permissions', () => {
  it('grants managers team approval and planning permissions', () => {
    assert.equal(hasPermission('manager', 'requests.approve.team'), true)
    assert.equal(hasPermission('manager', 'planning.view.team'), true)
    assert.equal(hasPermission('manager', 'users.manage'), false)
  })

  it('gives superadmins every catalog permission', () => {
    const effective = getEffectivePermissions({
      ...baseUser,
      role: 'superadmin',
    })

    assert.equal(effective.grantedCount, rolePermissions.superadmin.length)
    assert.equal(
      effective.permissions.every((item) => item.granted),
      true
    )
  })

  it('blocks every permission for inactive users while keeping the role', () => {
    const effective = getEffectivePermissions({
      ...baseUser,
      role: 'hr',
      status: 'inactive',
    })

    assert.equal(effective.role, 'hr')
    assert.equal(effective.grantedCount, 0)
    assert.equal(
      effective.permissions.every(
        (item) => !item.granted && item.source === 'lifecycle-block'
      ),
      true
    )
  })
})
