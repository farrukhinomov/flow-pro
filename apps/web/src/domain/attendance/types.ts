export const DEFAULT_EMPLOYEE_ID = 'usr-marta-lindgren'
export const DEFAULT_EMPLOYEE_NAME = 'Marta Lindgren'

export type ViewerRole = 'employee' | 'teammate' | 'manager' | 'admin'

export type VisibilityLevel = 'hidden' | 'state-only' | 'operational' | 'full'

export type AttendanceCategory =
  'remote' | 'leave' | 'unavailable' | 'sickness' | 'custom'

export type WorkLocation = 'office' | 'home-office'

export type WorkState = 'not-working' | 'working' | 'break' | 'finished'

export type ClockEventType =
  'clock-in' | 'start-break' | 'resume-work' | 'clock-out'

export type SyncState =
  | 'local'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'cancelled'

export type ClockEventSource = 'user' | 'manual' | 'terminal' | 'system'

export type ClockEventDevice = {
  type: 'browser' | 'terminal' | 'mobile' | 'unknown'
  label: string
}

export type ClockEventGeo = {
  latitude: number
  longitude: number
  accuracy?: number
}

export type AttendanceStatusType = {
  id: string
  code: string
  label: string
  category: AttendanceCategory
  color: string
  teammateVisibility: VisibilityLevel
  managerVisibility: VisibilityLevel
  adminVisibility: VisibilityLevel
  requiresApproval: boolean
  auditRequired: boolean
  updatedAt: string
}

export type ClockEvent = {
  id: string
  employeeId: string
  type: ClockEventType
  occurredAt: string
  location?: WorkLocation
  source: ClockEventSource
  device?: ClockEventDevice
  geo?: ClockEventGeo
  syncState: SyncState
}

export type ProposedClockEvent = Pick<
  ClockEvent,
  'id' | 'type' | 'occurredAt' | 'location'
>

export type AppliedTimeCorrection = {
  id: string
  requestId: string
  employeeId: string
  date: string
  clockIn?: string
  clockOut?: string
  proposedEvents?: ProposedClockEvent[]
  reason?: string
  approvedById: string
  approvedByName: string
  approvedAt: string
  createdAt: string
}

export type WorkContract = {
  id: string
  employeeId: string
  effectiveFrom: string
  weeklyHours: number
  workdays: number[]
  dailyHours: Partial<Record<number, number>>
}

export type PublicHoliday = {
  id: string
  date: string
  name: string
  region: string
  source: 'seed' | 'imported' | 'policy'
}

export type CompanyHoliday = {
  id: string
  date: string
  name: string
  paid: boolean
}

export type SicknessPrivacyMode =
  'medical-confidential' | 'manager-operational' | 'standard-visibility'

export type VacationCarryoverPolicy = {
  enabled: boolean
  maxDays: number
  expiresMonth: number
  expiresDay: number
}

export type BreakPolicy = {
  afterHours: number
  minimumMinutes: number
}

export type PeriodWindowPolicy = {
  monthsBack: number
  monthsForward: number
}

export type AttendancePolicyConfig = {
  id: 'default'
  countryCode: string
  regionCode: string
  companyHolidays: CompanyHoliday[]
  defaultWeeklyHours: number
  defaultWorkdays: number[]
  vacationAnnualDays: number
  vacationCarryover: VacationCarryoverPolicy
  sicknessPrivacyMode: SicknessPrivacyMode
  legalBreaks: BreakPolicy[]
  periodWindows: {
    timesheet: PeriodWindowPolicy
    reports: PeriodWindowPolicy
    planning: PeriodWindowPolicy
  }
  approvalRules: {
    autoApproveBookingCorrections: boolean
    autoApproveBookingCorrectionThresholdMinutes: number
    autoApproveNonRequiredAbsences: boolean
  }
  updatedAt: string
}

export type MonthlyTimesheetApproval = {
  id: string
  employeeId: string
  periodMonth: string
  status: 'open' | 'signed'
  signedById?: string
  signedByName?: string
  signedAt?: string
  note?: string
  payrollExportedAt?: string
  pdfExportedAt?: string
  updatedAt: string
}

export type AttendanceOperationType =
  | 'absence.upsert'
  | 'absence.delete'
  | 'approval-workflow.upsert'
  | 'approval-workflow.delete'
  | 'attachment.upsert'
  | 'attachment.delete'
  | 'clock-event.create'
  | 'clock-event.update'
  | 'clock-event.delete'
  | 'attendance-policy.upsert'
  | 'attendance-type.upsert'
  | 'attendance-type.delete'
  | 'notification.mark-read'
  | 'notification.upsert'
  | 'notification.delete'
  | 'notification-preferences.upsert'
  | 'organization-catalog.upsert'
  | 'payroll-export.upsert'
  | 'payroll-export.delete'
  | 'user.invite'
  | 'user.upsert'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'request.submit'
  | 'request.approve'
  | 'request.reject'
  | 'request.cancel'
  | 'timesheet.sign'
  | 'timesheet.export'

export type OutboxOperation = {
  id: string
  type: AttendanceOperationType
  aggregate:
    | 'absence'
    | 'approval-workflow'
    | 'attachment'
    | 'clock-event'
    | 'attendance-policy'
    | 'attendance-type'
    | 'notification'
    | 'notification-preferences'
    | 'organization-catalog'
    | 'payroll-export'
    | 'user'
    | 'request'
    | 'timesheet'
  aggregateId: string
  payload: unknown
  clientCreatedAt: string
  status: Exclude<SyncState, 'local'>
  attemptCount: number
  lastError?: string
  syncedAt?: string
  conflict?: {
    serverVersion?: string
    localVersion?: string
    message: string
    remotePayload?: unknown
    resolution?: 'local-wins' | 'remote-wins' | 'manual'
    resolvedAt?: string
  }
}

export type SyncMeta = {
  key: 'attendance-sync'
  isOnline: boolean
  pendingCount: number
  lastSyncedAt?: string
  lastError?: string
  serverCursor?: number
  projectionHydration?: Record<
    string,
    {
      itemCount: number
      lastError?: string
      lastHydratedAt?: string
    }
  >
}

export type TimelineItem = {
  id: string
  time: string
  label: string
  tone: 'default' | 'muted' | 'warning'
}

export type TodayProjection = {
  state: WorkState
  location: WorkLocation
  startedAt?: string
  breakStartedAt?: string
  finishedAt?: string
  workedMs: number
  breakMs: number
  flexMs: number
  timeline: TimelineItem[]
}

export type AttendanceCommandResult = {
  event: ClockEvent
  operation: OutboxOperation
}

export type AttendanceCommandErrorCode =
  | 'clock-in.invalid-state'
  | 'start-break.invalid-state'
  | 'resume-work.invalid-state'
  | 'clock-out.invalid-state'
