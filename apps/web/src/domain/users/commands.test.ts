import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createUserDeactivateOperation,
  createUserInviteOperation,
  createUserReactivateOperation,
  createUserUpsertOperation,
  makeUserId,
} from './commands'
import type { EmployeeUser } from './types'

const user: EmployeeUser = {
  id: 'usr-hannah-fischer',
  firstName: 'Hannah',
  lastName: 'Fischer',
  username: 'hannah.fischer',
  email: 'hannah.fischer@flowpro.local',
  phoneNumber: '+49 151 0000000',
  status: 'active',
  role: 'employee',
  team: 'B2X Platform',
  manager: 'Tobias Weber',
  workPattern: 'Full-time · Hybrid',
  visibilityScope: 'Availability only',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-24T08:00:00.000Z'),
}

describe('user commands', () => {
  it('normalizes user ids from usernames', () => {
    assert.equal(makeUserId(' Hannah.Fischer '), 'usr-hannah-fischer')
    assert.equal(makeUserId('Kai Neumann!'), 'usr-kai-neumann')
  })

  it('creates local-first user operations with stable aggregate fields', () => {
    const now = new Date('2026-05-24T09:00:00.000Z')
    const upsert = createUserUpsertOperation(user, now)
    const invite = createUserInviteOperation(user, 'Welcome', now)
    const reactivation = createUserReactivateOperation(user, now)

    assert.equal(upsert.type, 'user.upsert')
    assert.equal(upsert.aggregate, 'user')
    assert.equal(upsert.aggregateId, user.id)
    assert.equal(upsert.clientCreatedAt, now.toISOString())
    assert.equal(upsert.status, 'pending')
    assert.equal(invite.type, 'user.invite')
    assert.deepEqual(invite.payload, user)
    assert.equal(reactivation.type, 'user.reactivate')
    assert.deepEqual(reactivation.payload, user)
  })

  it('creates replayable deactivation payloads with the full user state', () => {
    const now = new Date('2026-05-24T09:00:00.000Z')
    const deactivatedUser: EmployeeUser = {
      ...user,
      deactivatedAt: now,
      deactivatedBy: 'usr-marta-lindgren',
      deactivationReason: 'Left company',
      retentionUntil: new Date('2036-05-24T09:00:00.000Z'),
      status: 'inactive',
    }
    const operation = createUserDeactivateOperation(deactivatedUser, now)

    assert.equal(operation.type, 'user.deactivate')
    assert.deepEqual(operation.payload, deactivatedUser)
  })
})
