import {
  canViewFullAudit,
  getDataScope,
  type AppViewer,
} from '@/domain/access/access-control'
import type {
  AttendanceStatusType,
  VisibilityLevel,
} from '@/domain/attendance/types'
import type {
  EmployeeRequest,
  RequestAttachment,
} from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'

export type ConsentPurpose =
  'attendance-processing' | 'absence-planning' | 'payroll-export' | 'analytics'

export type ConsentRecord = {
  id: string
  employeeId: string
  purpose: ConsentPurpose
  granted: boolean
  recordedAt: string
  source: 'seed' | 'user' | 'admin'
}

export type RetentionRule = {
  id: string
  dataset: 'clock-events' | 'requests' | 'audit-events' | 'payroll-exports'
  retentionYears: number
  legalBasis: string
}

export type DataSubjectRequestType =
  'export-data' | 'delete-user-data' | 'rectify-data' | 'restrict-processing'

export type DataSubjectRequest = {
  id: string
  employeeId: string
  type: DataSubjectRequestType
  status: 'open' | 'in-review' | 'completed' | 'rejected'
  requestedAt: string
  completedAt?: string
  note?: string
}

export type MaskedRequestView = {
  employeeName: string
  details: string
  statusLabel?: string
  reason?: string
  attachments: RequestAttachment[]
  auditVisible: boolean
  maskingReason?: string
  visibility: VisibilityLevel
}

export const defaultRetentionRules: RetentionRule[] = [
  {
    id: 'retention-clock-events',
    dataset: 'clock-events',
    retentionYears: 10,
    legalBasis: tStatic('privacyUi.retentionClockEvents'),
  },
  {
    id: 'retention-requests',
    dataset: 'requests',
    retentionYears: 6,
    legalBasis: tStatic('privacyUi.retentionRequests'),
  },
  {
    id: 'retention-audit-events',
    dataset: 'audit-events',
    retentionYears: 10,
    legalBasis: tStatic('privacyUi.retentionAuditEvents'),
  },
  {
    id: 'retention-payroll-exports',
    dataset: 'payroll-exports',
    retentionYears: 10,
    legalBasis: tStatic('privacyUi.retentionPayrollExports'),
  },
]

export function getDefaultConsentRecords(
  employeeId: string,
  now = new Date().toISOString()
): ConsentRecord[] {
  return ['attendance-processing', 'absence-planning', 'payroll-export'].map(
    (purpose) => ({
      id: `consent-${employeeId}-${purpose}`,
      employeeId,
      purpose: purpose as ConsentPurpose,
      granted: true,
      recordedAt: now,
      source: 'seed',
    })
  )
}

export function createDataSubjectRequest({
  employeeId,
  type,
  note,
  now = new Date().toISOString(),
}: {
  employeeId: string
  type: DataSubjectRequestType
  note?: string
  now?: string
}): DataSubjectRequest {
  return {
    id: `dsr-${employeeId}-${type}-${now.slice(0, 10)}`,
    employeeId,
    type,
    status: 'open',
    requestedAt: now,
    note,
  }
}

export function canExportPersonalData(
  viewer: AppViewer,
  employee: EmployeeUser
) {
  return canViewFullAudit(viewer) || viewer.employeeId === employee.id
}

export function canDeletePersonalData(
  viewer: AppViewer,
  employee: EmployeeUser
) {
  return canViewFullAudit(viewer) && employee.status === 'inactive'
}

export function maskRequestForViewer({
  employee,
  request,
  statusType,
  viewer,
}: {
  employee: EmployeeUser
  request: EmployeeRequest
  statusType?: AttendanceStatusType
  viewer: AppViewer
}): MaskedRequestView {
  const scope = getDataScope({ employee, viewer })
  const isOwn = scope === 'own-details'
  const isFullAudit = scope === 'full-audit'
  const isManager = scope === 'team-operational'
  const isSensitive = statusType?.category === 'sickness'
  const visibility = getRequestVisibility({
    isSensitive,
    isFullAudit,
    isManager,
    isOwn,
  })
  const canSeeOperationalDetails =
    isOwn || isFullAudit || (isManager && !isSensitive)
  const canSeePrivateDetails = isOwn || isFullAudit

  if (visibility === 'hidden') {
    return {
      employeeName: tStatic('privacyUi.hiddenByPolicy'),
      details: tStatic('privacyUi.confidentialAbsence'),
      attachments: [],
      auditVisible: false,
      maskingReason: tStatic('privacyUi.onlyHrAdminEmployeeCanViewSensitive'),
      visibility,
    }
  }

  return {
    employeeName:
      isOwn || isFullAudit || isManager ? request.employeeName : 'Team member',
    details: canSeeOperationalDetails
      ? getOperationalRequestDetails(request)
      : getStateOnlyRequestDetails(request),
    statusLabel: canSeeOperationalDetails
      ? (request.statusLabel ?? request.subtype)
      : undefined,
    reason: canSeePrivateDetails ? request.reason : undefined,
    attachments: canSeePrivateDetails ? (request.attachments ?? []) : [],
    auditVisible: canSeePrivateDetails,
    maskingReason: canSeePrivateDetails
      ? undefined
      : isManager
        ? tStatic('privacyUi.managerViewLimited')
        : tStatic('privacyUi.teammateViewLimited'),
    visibility,
  }
}

function getRequestVisibility({
  isFullAudit,
  isManager,
  isOwn,
  isSensitive,
}: {
  isFullAudit: boolean
  isManager: boolean
  isOwn: boolean
  isSensitive: boolean
}): VisibilityLevel {
  if (isOwn || isFullAudit) return 'full'
  if (isSensitive && isManager) return 'state-only'
  if (isSensitive) return 'hidden'
  if (isManager) return 'operational'

  return 'state-only'
}

function getStateOnlyRequestDetails(request: EmployeeRequest) {
  if (request.kind === 'booking-correction')
    return tStatic('privacyUi.timeCorrection')
  if (request.statusCode === 'HO') return tStatic('privacyUi.remote')

  return tStatic('privacyUi.unavailable')
}

function getOperationalRequestDetails(request: EmployeeRequest) {
  const label = request.statusLabel ?? request.subtype

  if (request.kind === 'booking-correction') {
    return request.subtype
  }

  return `${label}, ${request.fromDate} - ${request.toDate}`
}
