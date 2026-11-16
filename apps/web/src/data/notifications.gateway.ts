import type {
  FlowProNotification,
  NotificationPreferences,
} from '@/domain/notifications/types'
import {
  getNotificationPreferencesWorkflow,
  listNotificationWorkflowItems,
  markAllNotificationsReadWorkflow,
  markNotificationReadWorkflow,
  saveNotificationPreferencesWorkflow,
  shouldFallbackToLocalNotifications,
} from './api/notifications.api'
import {
  cacheNotifications,
  getNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
} from './local/notifications.repo'

export async function listNotificationsBackendFirst(
  recipientUserId: string
): Promise<FlowProNotification[]> {
  try {
    const notifications = await listNotificationWorkflowItems()
    await cacheNotifications(notifications)
    return notifications
  } catch (error) {
    if (!shouldFallbackToLocalNotifications(error)) throw error
  }

  return listNotificationsForUser(recipientUserId)
}

export async function markNotificationReadBackendFirst(notificationId: string) {
  try {
    const notification = await markNotificationReadWorkflow(notificationId)
    await cacheNotifications([notification])
    return notification
  } catch (error) {
    if (!shouldFallbackToLocalNotifications(error)) throw error
  }

  return markNotificationRead(notificationId)
}

export async function markAllNotificationsReadBackendFirst(
  recipientUserId: string
) {
  try {
    return await markAllNotificationsReadWorkflow()
  } catch (error) {
    if (!shouldFallbackToLocalNotifications(error)) throw error
  }

  return markAllNotificationsRead(recipientUserId)
}

export async function getNotificationPreferencesBackendFirst(
  ownerUserId: string
) {
  try {
    return await getNotificationPreferencesWorkflow()
  } catch (error) {
    if (!shouldFallbackToLocalNotifications(error)) throw error
  }

  return getNotificationPreferences(ownerUserId)
}

export async function saveNotificationPreferencesBackendFirst(
  preferences: Omit<
    NotificationPreferences,
    'id' | 'ownerUserId' | 'updatedAt'
  >,
  ownerUserId: string
) {
  try {
    return await saveNotificationPreferencesWorkflow(preferences)
  } catch (error) {
    if (!shouldFallbackToLocalNotifications(error)) throw error
  }

  return saveNotificationPreferences(preferences, ownerUserId)
}
