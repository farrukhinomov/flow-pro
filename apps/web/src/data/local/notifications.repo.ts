import {
  createNotificationMarkReadOperation,
  createNotificationPreferencesUpsertOperation,
} from '@/domain/notifications/commands'
import type {
  FlowProNotification,
  NotificationPreferences,
} from '@/domain/notifications/types'
import { enqueueOutbox } from './attendance.repo'
import { getAllFromStore, getFromStore, putInStore, putManyInStore } from './db'

const DEFAULT_NOTIFICATION_PREFERENCES_OWNER_ID = 'default'
const LEGACY_LOCAL_STORAGE_KEY = 'flowpro.notification-preferences'

export const defaultNotificationPreferences: NotificationPreferences = {
  id: getNotificationPreferencesId(DEFAULT_NOTIFICATION_PREFERENCES_OWNER_ID),
  approvalQueue: true,
  requestDecisions: true,
  securityEmails: true,
  syncFailures: true,
  timesheetExceptions: true,
  weeklySummary: false,
  updatedAt: new Date(0).toISOString(),
}

export function getNotificationPreferencesId(ownerUserId: string) {
  return `notification-preferences-${ownerUserId}`
}

export async function getNotificationPreferences(
  ownerUserId = DEFAULT_NOTIFICATION_PREFERENCES_OWNER_ID
) {
  const id = getNotificationPreferencesId(ownerUserId)
  const current = await getFromStore<NotificationPreferences>(
    'notificationPreferences',
    id
  )

  if (current) return { ...defaultNotificationPreferences, ...current }

  const migrated = readLegacyPreferences()
  const preferences: NotificationPreferences = {
    ...defaultNotificationPreferences,
    ...migrated,
    id,
    ownerUserId,
    updatedAt: new Date().toISOString(),
  }

  await putInStore('notificationPreferences', preferences)

  return preferences
}

export async function saveNotificationPreferences(
  preferences: Omit<
    NotificationPreferences,
    'id' | 'ownerUserId' | 'updatedAt'
  >,
  ownerUserId = DEFAULT_NOTIFICATION_PREFERENCES_OWNER_ID
) {
  const id = getNotificationPreferencesId(ownerUserId)
  const nextPreferences: NotificationPreferences = {
    ...defaultNotificationPreferences,
    ...preferences,
    id,
    ownerUserId,
    updatedAt: new Date().toISOString(),
  }

  await putInStore('notificationPreferences', nextPreferences)
  await enqueueOutbox(
    createNotificationPreferencesUpsertOperation(nextPreferences)
  )

  return nextPreferences
}

export async function listNotificationsForUser(recipientUserId: string) {
  const notifications =
    await getAllFromStore<FlowProNotification>('notifications')

  return notifications
    .filter((notification) => notification.recipientUserId === recipientUserId)
    .sort((first, second) => {
      const firstCreatedAt = new Date(first.createdAt).getTime()
      const secondCreatedAt = new Date(second.createdAt).getTime()

      return secondCreatedAt - firstCreatedAt
    })
}

export async function cacheNotifications(notifications: FlowProNotification[]) {
  await putManyInStore(
    'notifications',
    notifications.map((notification) => ({
      ...notification,
      syncState: notification.syncState ?? 'synced',
    }))
  )
}

export async function getUnreadNotificationCount(recipientUserId: string) {
  const notifications = await listNotificationsForUser(recipientUserId)

  return notifications.filter((notification) => !notification.readAt).length
}

export async function markNotificationRead(notificationId: string) {
  const current = await getFromStore<FlowProNotification>(
    'notifications',
    notificationId
  )

  if (!current) {
    throw new Error('Notification was not found.')
  }

  if (current.readAt) return current

  const nextNotification: FlowProNotification = {
    ...current,
    readAt: new Date().toISOString(),
    syncState: 'pending',
  }

  await putInStore('notifications', nextNotification)
  await enqueueOutbox(createNotificationMarkReadOperation(nextNotification))

  return nextNotification
}

export async function markAllNotificationsRead(recipientUserId: string) {
  const notifications = await listNotificationsForUser(recipientUserId)
  const unreadNotifications = notifications.filter(
    (notification) => !notification.readAt
  )

  await Promise.all(
    unreadNotifications.map((notification) =>
      markNotificationRead(notification.id)
    )
  )

  return unreadNotifications.length
}

function readLegacyPreferences() {
  if (typeof window === 'undefined') return undefined

  try {
    const stored = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY)

    return stored
      ? (JSON.parse(stored) as Partial<NotificationPreferences>)
      : undefined
  } catch {
    return undefined
  }
}
