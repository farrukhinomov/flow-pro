import type { ProposedClockEvent, SyncState } from '@/domain/attendance/types'

export type EmployeeRequestKind =
  'absence' | 'booking-correction' | 'official-absence'

export type EmployeeRequestStatus =
  'submitted' | 'approved' | 'rejected' | 'cancelled'

export type RequestDecision = 'approve' | 'reject'

export type RequestApprovalStep = {
  id: string
  label: string
  approverIds: string[]
  approverNames: string[]
  requireAll: boolean
  status: 'pending' | 'approved' | 'rejected' | 'skipped'
  decisions: RequestDecisionSummary[]
}

export type RequestApprovalFlow = {
  currentStepIndex: number
  steps: RequestApprovalStep[]
  autoApproved?: boolean
}

export type RequestPartialDayMode =
  'full-day' | 'morning' | 'afternoon' | 'custom'

export type RequestPartialDay = {
  mode: RequestPartialDayMode
  startTime?: string
  endTime?: string
}

export type RequestRecurrence = {
  frequency: 'none' | 'weekly'
  occurrences: number
}

export type RequestAttachment = {
  id: string
  name: string
  size: number
  type: string
  addedAt: string
  objectKey?: string
  sha256?: string
  serverVersion?: string
  storageProvider?: string
  uploadedAt?: string
  ownerUserId?: string
}

export type RequestSubmissionDraft = {
  kind: EmployeeRequestKind
  employeeId: string
  employeeName: string
  fromDate: string
  toDate: string
  statusTypeId?: string
  statusCode?: string
  statusLabel?: string
  subtype: string
  clockIn?: string
  clockOut?: string
  correctionDeltaMinutes?: number
  proposedEvents?: ProposedClockEvent[]
  approvalFlow?: RequestApprovalFlow
  partialDay?: RequestPartialDay
  recurrence?: RequestRecurrence
  seriesId?: string
  attachments?: RequestAttachment[]
  reason?: string
}

export type RequestDecisionSummary = {
  decision: RequestDecision
  decidedById: string
  decidedByName: string
  decidedAt: string
  comment?: string
}

export type EmployeeRequest = {
  id: string
  kind: EmployeeRequestKind
  employeeId: string
  employeeName: string
  fromDate: string
  toDate: string
  statusTypeId?: string
  statusCode?: string
  statusLabel?: string
  subtype: string
  clockIn?: string
  clockOut?: string
  proposedEvents?: ProposedClockEvent[]
  partialDay?: RequestPartialDay
  recurrence?: RequestRecurrence
  seriesId?: string
  attachments?: RequestAttachment[]
  reason?: string
  status: EmployeeRequestStatus
  submittedAt: string
  updatedAt: string
  decision?: RequestDecisionSummary
  approvalFlow?: RequestApprovalFlow
  syncState: SyncState
}

export type ApprovedAbsenceRecord = {
  id: string
  requestId: string
  employeeId: string
  employeeName: string
  fromDate: string
  toDate: string
  statusTypeId?: string
  statusCode?: string
  statusLabel?: string
  subtype: string
  partialDay?: RequestPartialDay
  reason?: string
  source: 'approved-request'
  approvedAt: string
  syncState?: SyncState
}

export type AuditEvent = {
  id: string
  aggregate:
    | 'request'
    | 'user'
    | 'attendance-type'
    | 'attendance-policy'
    | 'clock-event'
    | 'employment-contract'
    | 'notification'
    | 'organization-catalog'
    | 'payroll-export'
    | 'privacy-access'
    | 'sync'
    | 'system'
    | 'timesheet'
  aggregateId: string
  action: string
  actorId: string
  actorName: string
  createdAt: string
  classification?: 'operational' | 'personal-data' | 'sensitive' | 'system'
  hash?: string
  immutable?: boolean
  metadata?: Record<string, unknown>
  previousHash?: string
  summary: string
}

export type RequestCommandResult = {
  request: EmployeeRequest
  auditEvent: AuditEvent
}
