import {
  createUserDeactivateOperation,
  createUserInviteOperation,
  createUserReactivateOperation,
  createUserUpsertOperation,
  makeUserId,
} from '@/domain/users/commands'
import {
  deactivateEmployeeUserRecord,
  reactivateEmployeeUserRecord,
} from '@/domain/users/lifecycle'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'
import { enqueueOutbox } from './attendance.repo'
import { appendAuditEvent } from './audit.repo'
import { getAllFromStore, putInStore } from './db'

function toDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) return date
  }

  return fallback
}

function normalizeEmployeeUser(user: EmployeeUser): EmployeeUser {
  const createdAt = toDate(user.createdAt)
  const updatedAt = toDate(user.updatedAt, createdAt)

  return {
    ...user,
    createdAt,
    lastSeenAt: user.lastSeenAt
      ? toDate(user.lastSeenAt, updatedAt)
      : undefined,
    nextReviewAt: user.nextReviewAt
      ? toDate(user.nextReviewAt, updatedAt)
      : undefined,
    deactivatedAt: user.deactivatedAt
      ? toDate(user.deactivatedAt, updatedAt)
      : undefined,
    retentionUntil: user.retentionUntil
      ? toDate(user.retentionUntil, updatedAt)
      : undefined,
    updatedAt,
  }
}

export async function listEmployeeUsers() {
  const users = (await getAllFromStore<EmployeeUser>('employeeUsers')).map(
    normalizeEmployeeUser
  )

  return users.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1

    return `${a.firstName} ${a.lastName}`.localeCompare(
      `${b.firstName} ${b.lastName}`
    )
  })
}

export async function upsertEmployeeUser(user: EmployeeUser) {
  const nextUser: EmployeeUser = {
    ...user,
    updatedAt: new Date(),
  }

  await putInStore('employeeUsers', nextUser)
  await appendAuditEvent({
    id: `audit-user-${nextUser.id}-${nextUser.updatedAt.getTime()}`,
    aggregate: 'user',
    aggregateId: nextUser.id,
    action: 'user.upserted',
    actorId: 'local-session',
    actorName: tStatic('usersUi.localSessionActor'),
    classification: 'personal-data',
    createdAt: nextUser.updatedAt.toISOString(),
    metadata: {
      role: nextUser.role,
      status: nextUser.status,
      team: nextUser.team,
      visibilityScope: nextUser.visibilityScope,
    },
    summary: tStatic('usersUi.auditSummaries.profileUpdated', {
      name: `${nextUser.firstName} ${nextUser.lastName}`,
    }),
  })
  await enqueueOutbox(createUserUpsertOperation(nextUser))
}

export async function cacheEmployeeUser(user: EmployeeUser) {
  await putInStore('employeeUsers', normalizeEmployeeUser(user))
}

export async function deactivateEmployeeUser({
  actorId,
  reason,
  user,
}: {
  actorId?: string
  reason?: string
  user: EmployeeUser
}) {
  const nextUser = deactivateEmployeeUserRecord({ actorId, reason, user })

  await putInStore('employeeUsers', nextUser)
  await appendAuditEvent({
    id: `audit-user-${nextUser.id}-deactivated`,
    aggregate: 'user',
    aggregateId: nextUser.id,
    action: 'user.deactivated',
    actorId: actorId ?? 'local-session',
    actorName: actorId ?? tStatic('usersUi.localSessionActor'),
    classification: 'personal-data',
    createdAt: nextUser.updatedAt.toISOString(),
    metadata: {
      reason: nextUser.deactivationReason,
      retentionUntil: nextUser.retentionUntil?.toISOString(),
    },
    summary: tStatic('usersUi.auditSummaries.deactivatedWithRetention', {
      name: `${nextUser.firstName} ${nextUser.lastName}`,
    }),
  })
  await enqueueOutbox(createUserDeactivateOperation(nextUser))

  return nextUser
}

export async function reactivateEmployeeUser(user: EmployeeUser) {
  const nextUser = reactivateEmployeeUserRecord(user)

  await putInStore('employeeUsers', nextUser)
  await appendAuditEvent({
    id: `audit-user-${nextUser.id}-reactivated`,
    aggregate: 'user',
    aggregateId: nextUser.id,
    action: 'user.reactivated',
    actorId: 'local-session',
    actorName: tStatic('usersUi.localSessionActor'),
    classification: 'personal-data',
    createdAt: nextUser.updatedAt.toISOString(),
    summary: tStatic('usersUi.auditSummaries.reactivated', {
      name: `${nextUser.firstName} ${nextUser.lastName}`,
    }),
  })
  await enqueueOutbox(createUserReactivateOperation(nextUser))

  return nextUser
}

export async function inviteEmployeeUser({
  email,
  note,
  role,
}: {
  email: string
  note?: string
  role: UserRole
}) {
  const username = email.split('@')[0]?.toLowerCase() ?? email.toLowerCase()
  const [firstNamePart = 'New', lastNamePart = 'Employee'] = username.split('.')
  const now = new Date()
  const user: EmployeeUser = {
    id: makeUserId(username),
    firstName: toNamePart(firstNamePart),
    lastName: toNamePart(lastNamePart),
    username,
    email: email.toLowerCase(),
    phoneNumber: '',
    status: 'invited',
    role,
    roleProfileId: `role-profile-${role}`,
    team: 'Unassigned',
    manager: 'Unassigned',
    workPattern: 'Not configured',
    visibilityScope:
      role === 'manager'
        ? 'Team planning details'
        : role === 'admin' || role === 'hr' || role === 'superadmin'
          ? 'Request details and audit trail'
          : 'Availability only',
    nextReviewAt: new Date(
      now.getFullYear(),
      now.getMonth() + 3,
      now.getDate()
    ),
    createdAt: now,
    updatedAt: now,
  }

  await putInStore('employeeUsers', user)
  await appendAuditEvent({
    id: `audit-user-${user.id}-invited`,
    aggregate: 'user',
    aggregateId: user.id,
    action: 'user.invited',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: 'personal-data',
    createdAt: user.createdAt.toISOString(),
    metadata: {
      email: user.email,
      note,
      role,
    },
    summary: `${user.email} was invited as ${role}.`,
  })
  await enqueueOutbox(createUserInviteOperation(user, note))

  return user
}

function toNamePart(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
