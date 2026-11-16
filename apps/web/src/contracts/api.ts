import { z } from 'zod'
import type {
  AttendanceCategory,
  AttendancePolicyConfig,
  AttendanceOperationType,
  SyncState,
  VisibilityLevel,
} from '@/domain/attendance/types'
import type {
  EmployeeRequestKind,
  EmployeeRequestStatus,
  RequestAttachment,
  RequestDecision,
  RequestPartialDay,
  RequestRecurrence,
} from '@/domain/requests/types'
import type { UserRole, UserStatus } from '@/domain/users/types'

export type ApiId = string
export type ApiDate = string
export type ApiDateTime = string

export type ApiUserDto = {
  id: ApiId
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber?: string
  status: UserStatus
  role: UserRole
  team: string
  manager: string
  workPattern: string
  visibilityScope: string
  lastSeenAt?: ApiDateTime
  nextReviewAt?: ApiDate
  createdAt: ApiDateTime
  updatedAt: ApiDateTime
}

export type ApiAuthSessionDto = {
  tenantId: ApiId
  tenantSlug: string
  tenantName: string
  userId: ApiId
  externalSubject: string
  email: string
  displayName: string
  roles: UserRole[]
  permissions: string[]
}

export type ApiAttendanceStatusTypeDto = {
  id: ApiId
  code: string
  label: string
  category: AttendanceCategory
  color: string
  teammateVisibility: VisibilityLevel
  managerVisibility: VisibilityLevel
  adminVisibility: VisibilityLevel
  requiresApproval: boolean
  auditRequired: boolean
  updatedAt: ApiDateTime
}

export type ApiAttendancePolicyConfigDto = AttendancePolicyConfig

export type ApiTimeBookingType =
  'clockIn' | 'startBreak' | 'resumeWork' | 'clockOut'

export type ApiWorkLocation = 'office' | 'homeOffice'

export type ApiBookingSource =
  'web' | 'mobile' | 'terminal' | 'manual' | 'system'

export type ApiTimeBookingDto = {
  id: ApiId
  employeeId: ApiId
  type: ApiTimeBookingType
  occurredAt: ApiDateTime
  receivedAt: ApiDateTime
  location?: ApiWorkLocation | null
  source: ApiBookingSource
  supersedesBookingId?: ApiId | null
  correctionReason?: string | null
  deviceId?: string | null
  deviceSequence?: number | null
  latitude?: number | null
  longitude?: number | null
  accuracyMeters?: number | null
  isVoided: boolean
}

export type ApiEmployeeRequestDto = {
  id: ApiId
  kind: EmployeeRequestKind
  employeeId: ApiId
  employeeName: string
  fromDate: ApiDate
  toDate: ApiDate
  statusTypeId?: ApiId
  statusCode?: string
  statusLabel?: string
  subtype: string
  clockIn?: string
  clockOut?: string
  partialDay?: RequestPartialDay
  recurrence?: RequestRecurrence
  seriesId?: ApiId
  attachments?: RequestAttachment[]
  reason?: string
  status: EmployeeRequestStatus
  submittedAt: ApiDateTime
  updatedAt: ApiDateTime
  decision?: {
    decision: RequestDecision
    decidedById: ApiId
    decidedByName: string
    decidedAt: ApiDateTime
    comment?: string
  }
  syncState: SyncState
}

export type ApiAuditEventDto = {
  id: ApiId
  aggregate:
    | 'request'
    | 'user'
    | 'attendance-type'
    | 'attendance-policy'
    | 'clock-event'
    | 'timesheet'
  aggregateId: ApiId
  action: string
  actorId: ApiId
  actorName: string
  createdAt: ApiDateTime
  summary: string
}

export type ApiSyncOperationDto = {
  id: ApiId
  type: AttendanceOperationType
  aggregate:
    | 'absence'
    | 'approval-workflow'
    | 'attachment'
    | 'clock-event'
    | 'attendance-type'
    | 'attendance-policy'
    | 'notification'
    | 'notification-preferences'
    | 'organization-catalog'
    | 'payroll-export'
    | 'user'
    | 'request'
    | 'timesheet'
  aggregateId: ApiId
  payload: unknown
  clientCreatedAt: ApiDateTime
  status: Exclude<SyncState, 'local'>
  attemptCount: number
  lastError?: string
  syncedAt?: ApiDateTime
  conflict?: {
    serverVersion?: string
    localVersion?: string
    message: string
    remotePayload?: unknown
    resolution?: 'local-wins' | 'remote-wins' | 'manual'
    resolvedAt?: ApiDateTime
  }
}

export type ApiSyncBatchRequestDto = {
  protocol: 'flowpro-sync-v1'
  clientId: string
  schemaVersion: number
  operations: ApiSyncOperationDto[]
}

export type ApiSyncConflictDto = {
  operationId: ApiId
  aggregate: ApiSyncOperationDto['aggregate']
  aggregateId: ApiId
  message: string
  serverVersion: string
  remotePayload: unknown
}

export type ApiSyncBatchResponseDto = {
  accepted: {
    operationId: ApiId
    serverVersion: string
    syncedAt: ApiDateTime
  }[]
  conflicts: ApiSyncConflictDto[]
  rejected: {
    operationId: ApiId
    message: string
    retryable: boolean
  }[]
  serverTime: ApiDateTime
}

export type ApiSyncMetaDto = {
  isOnline: boolean
  pendingCount: number
  lastSyncedAt?: ApiDateTime
  lastError?: string
}

export type ApiOperationsHealthStatus = 'ok' | 'warning' | 'critical'

export type ApiOperationsHealthDto = {
  auditEventCount: number
  clientAggregateCount: number
  failedOutboxCount: number
  generatedAt: ApiDateTime
  lastAuditEventAt?: ApiDateTime | null
  lastOutboxError?: string | null
  lastProcessedOutboxAt?: ApiDateTime | null
  lastProjectionUpdatedAt?: ApiDateTime | null
  oldestPendingOutboxAt?: ApiDateTime | null
  pendingOutboxCount: number
  status: ApiOperationsHealthStatus
}

export type ApiSyncChangeDto = {
  sequence: number
  eventType: string
  aggregateType: string
  aggregateId: ApiId
  payload: unknown
  occurredAt: ApiDateTime
}

export type ApiSyncPageDto = {
  items: ApiSyncChangeDto[]
  nextCursor: number
}

export type ApiOnboardingStepKey =
  'company' | 'team' | 'absences' | 'first-clock-in'

export type ApiOnboardingStepDto = {
  step: ApiOnboardingStepKey
  resolved: boolean
  skipped: boolean
  resolvedAt?: ApiDateTime | null
}

export type ApiOnboardingStateDto = {
  status: 'in-progress' | 'completed'
  currentStep?: ApiOnboardingStepKey | null
  steps: ApiOnboardingStepDto[]
  completedAt?: ApiDateTime | null
}

export type ApiWorkspaceClaimStateDto = {
  hasWorkspace: boolean
  email: string
  displayName: string
  suggestedWorkspaceName: string
  suggestedSlug: string
}

export type ApiWorkspaceClaimResultDto = {
  tenantId: ApiId
  tenantSlug: string
  tenantName: string
  userId: ApiId
  employeeId: ApiId
  onboarding: ApiOnboardingStateDto
}

export type ApiCompanyProfileDto = {
  companyName: string
  countryCode?: string | null
  regionCode?: string | null
  timeZoneId: string
  weeklyHours: number
  onboarding: ApiOnboardingStateDto
}

export type ApiListResponse<T> = {
  items: T[]
  nextCursor?: string
}

export type ApiMutationResponse<T> = {
  item: T
  serverVersion: string
  syncedAt: ApiDateTime
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTime = z.string().datetime({ offset: true })
const apiId = z.string().min(1)

const userStatusSchema = z.enum(['active', 'invited', 'inactive', 'suspended'])
const userRoleSchema = z.enum([
  'employee',
  'manager',
  'hr',
  'admin',
  'superadmin',
])
const requestStatusSchema = z.enum([
  'submitted',
  'approved',
  'rejected',
  'cancelled',
])
const apiTimeBookingTypeSchema = z.enum([
  'clockIn',
  'startBreak',
  'resumeWork',
  'clockOut',
])
const apiWorkLocationSchema = z.enum(['office', 'homeOffice'])
const apiBookingSourceSchema = z.enum([
  'web',
  'mobile',
  'terminal',
  'manual',
  'system',
])

export const apiUserDtoSchema = z.object({
  id: apiId,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  status: userStatusSchema,
  role: userRoleSchema,
  team: z.string().min(1),
  manager: z.string().min(1),
  workPattern: z.string().min(1),
  visibilityScope: z.string().min(1),
  lastSeenAt: isoDateTime.optional(),
  nextReviewAt: isoDate.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<ApiUserDto>

export const apiAuthSessionDtoSchema = z.object({
  tenantId: apiId,
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1),
  userId: apiId,
  externalSubject: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  roles: z.array(userRoleSchema),
  permissions: z.array(z.string().min(1)),
}) satisfies z.ZodType<ApiAuthSessionDto>

export const apiTimeBookingDtoSchema = z.object({
  id: apiId,
  employeeId: apiId,
  type: apiTimeBookingTypeSchema,
  occurredAt: isoDateTime,
  receivedAt: isoDateTime,
  location: apiWorkLocationSchema.nullish(),
  source: apiBookingSourceSchema,
  supersedesBookingId: apiId.nullish(),
  correctionReason: z.string().nullish(),
  deviceId: z.string().nullish(),
  deviceSequence: z.number().int().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  accuracyMeters: z.number().nullish(),
  isVoided: z.boolean(),
}) satisfies z.ZodType<ApiTimeBookingDto>

export const apiEmployeeRequestDtoSchema = z.object({
  id: apiId,
  kind: z.enum(['absence', 'booking-correction', 'official-absence']),
  employeeId: apiId,
  employeeName: z.string().min(1),
  fromDate: isoDate,
  toDate: isoDate,
  statusTypeId: apiId.optional(),
  statusCode: z.string().optional(),
  statusLabel: z.string().optional(),
  subtype: z.string().min(1),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  proposedEvents: z
    .array(
      z.object({
        id: apiId,
        type: z.enum(['clock-in', 'start-break', 'resume-work', 'clock-out']),
        occurredAt: isoDateTime,
        location: z.enum(['office', 'home-office']).optional(),
      })
    )
    .optional(),
  partialDay: z
    .object({
      mode: z.enum(['full-day', 'morning', 'afternoon', 'custom']),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    })
    .optional(),
  recurrence: z
    .object({
      frequency: z.enum(['none', 'weekly']),
      occurrences: z.number().int().positive(),
    })
    .optional(),
  seriesId: apiId.optional(),
  attachments: z
    .array(
      z.object({
        id: apiId,
        name: z.string().min(1),
        size: z.number().nonnegative(),
        type: z.string().min(1),
        addedAt: isoDateTime,
      })
    )
    .optional(),
  reason: z.string().optional(),
  status: requestStatusSchema,
  submittedAt: isoDateTime,
  updatedAt: isoDateTime,
  decision: z
    .object({
      decision: z.enum(['approve', 'reject']),
      decidedById: apiId,
      decidedByName: z.string().min(1),
      decidedAt: isoDateTime,
      comment: z.string().optional(),
    })
    .optional(),
  syncState: z.enum(['local', 'pending', 'synced', 'failed', 'conflict']),
}) satisfies z.ZodType<ApiEmployeeRequestDto>

export const apiSyncMetaDtoSchema = z.object({
  isOnline: z.boolean(),
  pendingCount: z.number().int().nonnegative(),
  lastSyncedAt: isoDateTime.optional(),
  lastError: z.string().optional(),
}) satisfies z.ZodType<ApiSyncMetaDto>

export const apiOperationsHealthDtoSchema = z.object({
  auditEventCount: z.number().int().nonnegative(),
  clientAggregateCount: z.number().int().nonnegative(),
  failedOutboxCount: z.number().int().nonnegative(),
  generatedAt: isoDateTime,
  lastAuditEventAt: isoDateTime.nullish(),
  lastOutboxError: z.string().nullish(),
  lastProcessedOutboxAt: isoDateTime.nullish(),
  lastProjectionUpdatedAt: isoDateTime.nullish(),
  oldestPendingOutboxAt: isoDateTime.nullish(),
  pendingOutboxCount: z.number().int().nonnegative(),
  status: z.enum(['ok', 'warning', 'critical']),
}) satisfies z.ZodType<ApiOperationsHealthDto>

const apiOnboardingStepKeySchema = z.enum([
  'company',
  'team',
  'absences',
  'first-clock-in',
])

export const apiOnboardingStateDtoSchema = z.object({
  status: z.enum(['in-progress', 'completed']),
  currentStep: apiOnboardingStepKeySchema.nullish(),
  steps: z.array(
    z.object({
      step: apiOnboardingStepKeySchema,
      resolved: z.boolean(),
      skipped: z.boolean(),
      resolvedAt: isoDateTime.nullish(),
    })
  ),
  completedAt: isoDateTime.nullish(),
}) satisfies z.ZodType<ApiOnboardingStateDto>

export const apiWorkspaceClaimStateDtoSchema = z.object({
  hasWorkspace: z.boolean(),
  email: z.string().email(),
  displayName: z.string().min(1),
  suggestedWorkspaceName: z.string().min(1),
  suggestedSlug: z.string().min(1),
}) satisfies z.ZodType<ApiWorkspaceClaimStateDto>

export const apiWorkspaceClaimResultDtoSchema = z.object({
  tenantId: apiId,
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1),
  userId: apiId,
  employeeId: apiId,
  onboarding: apiOnboardingStateDtoSchema,
}) satisfies z.ZodType<ApiWorkspaceClaimResultDto>

export const apiCompanyProfileDtoSchema = z.object({
  companyName: z.string().min(1),
  countryCode: z.string().nullish(),
  regionCode: z.string().nullish(),
  timeZoneId: z.string().min(1),
  weeklyHours: z.number().positive(),
  onboarding: apiOnboardingStateDtoSchema,
}) satisfies z.ZodType<ApiCompanyProfileDto>

export function parseApiOnboardingStateDto(
  input: unknown
): ApiOnboardingStateDto {
  return apiOnboardingStateDtoSchema.parse(input)
}

export function parseApiWorkspaceClaimStateDto(
  input: unknown
): ApiWorkspaceClaimStateDto {
  return apiWorkspaceClaimStateDtoSchema.parse(input)
}

export function parseApiWorkspaceClaimResultDto(
  input: unknown
): ApiWorkspaceClaimResultDto {
  return apiWorkspaceClaimResultDtoSchema.parse(input)
}

export function parseApiCompanyProfileDto(
  input: unknown
): ApiCompanyProfileDto {
  return apiCompanyProfileDtoSchema.parse(input)
}

export function parseApiUserDto(input: unknown): ApiUserDto {
  return apiUserDtoSchema.parse(input)
}

export function parseApiAuthSessionDto(input: unknown): ApiAuthSessionDto {
  return apiAuthSessionDtoSchema.parse(input)
}

export function parseApiTimeBookingDto(input: unknown): ApiTimeBookingDto {
  return apiTimeBookingDtoSchema.parse(input)
}

export function parseApiEmployeeRequestDto(
  input: unknown
): ApiEmployeeRequestDto {
  return apiEmployeeRequestDtoSchema.parse(input)
}

export function parseApiSyncMetaDto(input: unknown): ApiSyncMetaDto {
  return apiSyncMetaDtoSchema.parse(input)
}

export function parseApiOperationsHealthDto(
  input: unknown
): ApiOperationsHealthDto {
  return apiOperationsHealthDtoSchema.parse(input)
}
