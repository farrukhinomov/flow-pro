import type { EmployeeUser } from './types'

const DEFAULT_RETENTION_YEARS = 7

export function deactivateEmployeeUserRecord({
  actorId,
  now = new Date(),
  reason,
  user,
}: {
  actorId?: string
  now?: Date
  reason?: string
  user: EmployeeUser
}): EmployeeUser {
  const retentionUntil = new Date(now)
  retentionUntil.setFullYear(
    retentionUntil.getFullYear() + DEFAULT_RETENTION_YEARS
  )

  return {
    ...user,
    status: 'inactive',
    deactivatedAt: now,
    deactivatedBy: actorId,
    deactivationReason: reason?.trim() || 'Access no longer required',
    retentionUntil,
    updatedAt: now,
  }
}

export function reactivateEmployeeUserRecord(
  user: EmployeeUser,
  now = new Date()
): EmployeeUser {
  return {
    ...user,
    status: 'active',
    deactivatedAt: undefined,
    deactivatedBy: undefined,
    deactivationReason: undefined,
    retentionUntil: undefined,
    updatedAt: now,
  }
}

/**
 * Describes a user's lifecycle state as a translation key rather than a
 * sentence.
 *
 * This function previously returned hardcoded English with an `en-GB` date, so
 * German users saw untranslated copy in the directory table and the user
 * drawer. Domain code must stay framework-free, so it returns the key plus the
 * raw date and the caller applies `t()` and the active locale.
 */
export type LifecycleSummary = {
  key: string
  retentionUntil?: Date
}

export function getLifecycleSummary(user: EmployeeUser): LifecycleSummary {
  if (user.status === 'inactive' && user.retentionUntil) {
    return {
      key: 'usersUi.lifecycle.retention',
      retentionUntil: user.retentionUntil,
    }
  }

  if (user.status === 'suspended') {
    return { key: 'usersUi.lifecycle.suspended' }
  }

  if (user.status === 'invited') {
    return { key: 'usersUi.lifecycle.invited' }
  }

  return { key: 'usersUi.lifecycle.active' }
}
