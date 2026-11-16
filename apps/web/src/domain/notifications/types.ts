export type NotificationPreferences = {
  id: string
  ownerUserId?: string
  approvalQueue: boolean
  requestDecisions: boolean
  securityEmails: boolean
  syncFailures: boolean
  timesheetExceptions: boolean
  weeklySummary: boolean
  updatedAt: string
}

export type FlowProNotification = {
  id: string
  recipientUserId: string
  type: string
  title: string
  sourceId?: string
  readAt?: string | null
  createdAt: string
  syncState?: 'synced' | 'pending' | 'failed' | 'conflict'
}
