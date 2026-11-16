import type { OutboxOperation } from '@/domain/attendance/types'
import type { FlowProNotification, NotificationPreferences } from './types'

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

export function createNotificationPreferencesUpsertOperation(
  preferences: NotificationPreferences,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'notification-preferences.upsert',
    aggregate: 'notification-preferences',
    aggregateId: preferences.id,
    payload: preferences,
    clientCreatedAt: preferences.updatedAt ?? now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createNotificationMarkReadOperation(
  notification: FlowProNotification,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'notification.mark-read',
    aggregate: 'notification',
    aggregateId: notification.id,
    payload: notification,
    clientCreatedAt: notification.readAt ?? now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}
