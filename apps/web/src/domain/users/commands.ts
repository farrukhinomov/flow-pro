import type { OutboxOperation } from '@/domain/attendance/types'
import type { EmployeeUser } from './types'

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

export function createUserUpsertOperation(
  user: EmployeeUser,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'user.upsert',
    aggregate: 'user',
    aggregateId: user.id,
    payload: user,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createUserInviteOperation(
  user: EmployeeUser,
  _note?: string,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'user.invite',
    aggregate: 'user',
    aggregateId: user.id,
    payload: user,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createUserDeactivateOperation(
  user: EmployeeUser,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'user.deactivate',
    aggregate: 'user',
    aggregateId: user.id,
    payload: user,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createUserReactivateOperation(
  user: EmployeeUser,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'user.reactivate',
    aggregate: 'user',
    aggregateId: user.id,
    payload: user,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function makeUserId(username: string) {
  return `usr-${username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}
