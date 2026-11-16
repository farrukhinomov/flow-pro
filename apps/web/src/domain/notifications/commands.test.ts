import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createNotificationMarkReadOperation,
  createNotificationPreferencesUpsertOperation,
} from './commands'
import type { FlowProNotification, NotificationPreferences } from './types'

describe('notification commands', () => {
  it('creates a preferences upsert outbox operation', () => {
    const preferences: NotificationPreferences = {
      id: 'prefs-user-1',
      ownerUserId: 'user-1',
      approvalQueue: true,
      requestDecisions: true,
      securityEmails: true,
      syncFailures: true,
      timesheetExceptions: false,
      weeklySummary: false,
      updatedAt: '2026-06-10T09:15:00.000Z',
    }

    const operation = createNotificationPreferencesUpsertOperation(
      preferences,
      new Date('2026-06-10T10:00:00.000Z')
    )

    assert.match(operation.id, /^op-/)
    assert.equal(operation.type, 'notification-preferences.upsert')
    assert.equal(operation.aggregate, 'notification-preferences')
    assert.equal(operation.aggregateId, preferences.id)
    assert.equal(operation.payload, preferences)
    assert.equal(operation.clientCreatedAt, preferences.updatedAt)
    assert.equal(operation.status, 'pending')
    assert.equal(operation.attemptCount, 0)
  })

  it('uses readAt or the supplied clock for mark-read operations', () => {
    const unreadNotification: FlowProNotification = {
      id: 'notification-1',
      recipientUserId: 'user-1',
      type: 'sync.failure',
      title: 'Sync needs attention',
      createdAt: '2026-06-10T08:00:00.000Z',
    }
    const readNotification: FlowProNotification = {
      ...unreadNotification,
      id: 'notification-2',
      readAt: '2026-06-10T08:30:00.000Z',
    }

    const fallbackOperation = createNotificationMarkReadOperation(
      unreadNotification,
      new Date('2026-06-10T10:00:00.000Z')
    )
    const readOperation = createNotificationMarkReadOperation(
      readNotification,
      new Date('2026-06-10T10:00:00.000Z')
    )

    assert.equal(fallbackOperation.type, 'notification.mark-read')
    assert.equal(fallbackOperation.aggregate, 'notification')
    assert.equal(fallbackOperation.aggregateId, unreadNotification.id)
    assert.equal(fallbackOperation.payload, unreadNotification)
    assert.equal(fallbackOperation.clientCreatedAt, '2026-06-10T10:00:00.000Z')
    assert.equal(readOperation.clientCreatedAt, readNotification.readAt)
  })
})
