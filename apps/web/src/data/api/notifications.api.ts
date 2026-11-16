import type {
  FlowProNotification,
  NotificationPreferences,
} from '@/domain/notifications/types'
import { FlowProApiError, flowProApi } from './http-client'

type NotificationPage = {
  items: FlowProNotification[]
  nextCursor?: string | null
}

export type ListNotificationWorkflowInput = {
  cursor?: string
  limit?: number
  unread?: boolean
  type?: string
  sourceId?: string
  search?: string
}

export type NotificationWorkflowPage = {
  items: FlowProNotification[]
  nextCursor?: string
}

export async function listNotificationWorkflowPage(
  input: ListNotificationWorkflowInput = {}
): Promise<NotificationWorkflowPage> {
  const response = await flowProApi.get<NotificationPage>(
    '/notification-center',
    {
      params: compactParams(input),
    }
  )

  return {
    items: mapNotifications(response.data.items),
    nextCursor: response.data.nextCursor ?? undefined,
  }
}

export async function listNotificationWorkflowItems(limit = 100) {
  const page = await listNotificationWorkflowPage({ limit })

  return page.items
}

export async function markNotificationReadWorkflow(notificationId: string) {
  const response = await flowProApi.post<FlowProNotification>(
    `/notification-center/${encodeURIComponent(notificationId)}/read`
  )

  return {
    ...response.data,
    syncState: response.data.syncState ?? 'synced',
  }
}

export async function markAllNotificationsReadWorkflow() {
  const response = await flowProApi.post<{ changedCount: number }>(
    '/notification-center/read-all'
  )

  return response.data.changedCount
}

export async function getNotificationPreferencesWorkflow() {
  const response = await flowProApi.get<NotificationPreferences>(
    '/notification-center/preferences'
  )

  return response.data
}

export async function saveNotificationPreferencesWorkflow(
  preferences: Omit<NotificationPreferences, 'id' | 'ownerUserId' | 'updatedAt'>
) {
  const response = await flowProApi.put<NotificationPreferences>(
    '/notification-center/preferences',
    preferences
  )

  return response.data
}

export function shouldFallbackToLocalNotifications(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapNotifications(notifications: FlowProNotification[]) {
  return notifications
    .map((notification) => ({
      ...notification,
      syncState: notification.syncState ?? 'synced',
    }))
    .sort((first, second) => {
      const firstCreatedAt = new Date(first.createdAt).getTime()
      const secondCreatedAt = new Date(second.createdAt).getTime()

      return secondCreatedAt - firstCreatedAt
    })
}

function compactParams(params: ListNotificationWorkflowInput) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}
