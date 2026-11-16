import { useCallback, useEffect, useState } from 'react'
import {
  listNotificationsBackendFirst,
  markAllNotificationsReadBackendFirst,
  markNotificationReadBackendFirst,
} from '@/data/notifications.gateway'
import {
  notifyLocalDataChanged,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type { FlowProNotification } from '@/domain/notifications/types'
import { useCurrentViewer } from '@/features/access/use-current-viewer'

export function useNotificationSummary() {
  const viewer = useCurrentViewer()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<FlowProNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const nextNotifications = await listNotificationsBackendFirst(
        viewer.employeeId
      )

      setNotifications(nextNotifications)
      setUnreadCount(
        nextNotifications.filter((notification) => !notification.readAt).length
      )
    } catch {
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [viewer.employeeId])

  useEffect(() => {
    startAttendanceAutoSync()

    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)
    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
    }
  }, [refresh])

  const markRead = useCallback(
    async (notificationId: string) => {
      await markNotificationReadBackendFirst(notificationId)
      await notifyLocalDataChanged()
      await refresh()
      void syncAttendanceOutbox()
    },
    [refresh]
  )

  const markAllRead = useCallback(async () => {
    const changedCount = await markAllNotificationsReadBackendFirst(
      viewer.employeeId
    )

    if (changedCount > 0) {
      await notifyLocalDataChanged()
      await refresh()
      void syncAttendanceOutbox()
    }

    return changedCount
  }, [refresh, viewer.employeeId])

  return {
    isLoading,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  }
}
