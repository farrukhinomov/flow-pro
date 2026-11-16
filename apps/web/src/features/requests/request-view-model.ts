import { eachDayOfInterval, format, isWeekend, parseISO } from 'date-fns'
import {
  canViewFullAudit,
  getViewerManagedTeams,
  type AppViewer,
} from '@/domain/access/access-control'
import type { AttendanceStatusType } from '@/domain/attendance/types'
import {
  maskRequestForViewer,
  type MaskedRequestView,
} from '@/domain/privacy/gdpr'
import { getCurrentApprovalStep } from '@/domain/requests/approval-routing'
import type {
  EmployeeRequest,
  EmployeeRequestKind,
  EmployeeRequestStatus,
  RequestAttachment,
  RequestPartialDayMode,
  RequestDecision,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import type { Locale } from '@/i18n'
import { formatMediumDate } from '@/i18n/format'

type Translator = (
  key: string,
  vars?: Record<string, string | number>
) => string

export type RequestKind = 'absence' | 'booking' | 'official'

export type AbsenceTypeOption = {
  code: string
  label: string
  value: string
}

export type RequestRow = {
  id: string
  date: string
  type: string
  details: string
  status: EmployeeRequestStatus
  owner?: string
  request: EmployeeRequest
  view: MaskedRequestView
}

export type ApprovalEmployeeOption = {
  id: string
  name: string
}

export const bookingTypes = [
  {
    value: 'pair',
    label: 'Add booking pair',
    labelKey: 'requestsUi.bookingTypePair',
  },
  {
    value: 'clock-in',
    label: 'Add clock-in',
    labelKey: 'requestsUi.bookingTypeClockIn',
  },
  {
    value: 'clock-out',
    label: 'Add clock-out',
    labelKey: 'requestsUi.bookingTypeClockOut',
  },
  {
    value: 'break',
    label: 'Add break',
    labelKey: 'requestsUi.bookingTypeBreak',
  },
  {
    value: 'special',
    label: 'Special booking',
    labelKey: 'requestsUi.bookingTypeSpecial',
  },
]

export const officialTypes = [
  {
    value: 'full-day',
    label: 'Complete day',
    labelKey: 'requestsUi.officialTypeFullDay',
  },
  {
    value: 'before-start',
    label: 'Before work starts',
    labelKey: 'requestsUi.officialTypeBeforeStart',
  },
  {
    value: 'after-end',
    label: 'After work ends',
    labelKey: 'requestsUi.officialTypeAfterEnd',
  },
]

export const partialDayOptions: {
  value: RequestPartialDayMode
  label: string
  labelKey: string
}[] = [
  {
    value: 'full-day',
    label: 'Full day',
    labelKey: 'requestsUi.partialFullDay',
  },
  { value: 'morning', label: 'Morning', labelKey: 'requestsUi.partialMorning' },
  {
    value: 'afternoon',
    label: 'Afternoon',
    labelKey: 'requestsUi.partialAfternoon',
  },
  {
    value: 'custom',
    label: 'Custom hours',
    labelKey: 'requestsUi.partialCustomHours',
  },
]

export const statusLabels: Record<EmployeeRequestStatus, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const statusLabelKeys: Record<EmployeeRequestStatus, string> = {
  submitted: 'requests.status.submitted',
  approved: 'requests.status.approved',
  rejected: 'requests.status.rejected',
  cancelled: 'requests.status.cancelled',
}

export const statusStyles: Record<EmployeeRequestStatus, string> = {
  submitted:
    'border-amber-200 bg-amber-500/10 text-amber-600 dark:border-amber-800',
  approved:
    'border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:border-emerald-800',
  rejected: 'border-rose-200 bg-rose-500/10 text-rose-600 dark:border-rose-800',
  cancelled:
    'border-slate-200 bg-slate-500/10 text-slate-600 dark:border-slate-800',
}

export const requestKindLabels: Record<EmployeeRequestKind, string> = {
  absence: 'Absence',
  'booking-correction': 'Booking correction',
  'official-absence': 'Official absence',
}

export const requestKindLabelKeys: Record<EmployeeRequestKind, string> = {
  absence: 'requests.kind.absence',
  'booking-correction': 'requests.kind.bookingCorrection',
  'official-absence': 'requests.kind.officialAbsence',
}

export function getStatusLabel(status: EmployeeRequestStatus, t?: Translator) {
  return t ? t(statusLabelKeys[status]) : statusLabels[status]
}

export function getRequestKindLabel(kind: EmployeeRequestKind, t?: Translator) {
  return t ? t(requestKindLabelKeys[kind]) : requestKindLabels[kind]
}

export function getTodayString(now = new Date()) {
  return format(now, 'yyyy-MM-dd')
}

/**
 * Number of working days in the inclusive range.
 *
 * Counts weekdays directly rather than taking a business-day difference and
 * adding one for the start date: that shortcut credited a day even when the
 * range contained none, so a Saturday-only absence was summarised as "1 day".
 */
export function calcBusinessDays(from: string, to: string) {
  if (!from || !to || to < from) return 0

  try {
    const start = parseISO(from)
    const end = parseISO(to)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

    return eachDayOfInterval({ start, end }).filter((day) => !isWeekend(day))
      .length
  } catch {
    return 0
  }
}

/**
 * `locale` is required on every date helper below. It used to be optional with
 * a `date-fns` fallback, which meant any caller that forgot it silently
 * rendered English month names to German users.
 */
function formatRequestDate(value: string, locale: Locale) {
  return formatMediumDate(value, locale)
}

export function formatDateRange(from: string, to: string, locale: Locale) {
  const fromLabel = formatRequestDate(from, locale)
  const toLabel = formatRequestDate(to, locale)

  return from === to ? fromLabel : `${fromLabel} - ${toLabel}`
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatPartialDay(
  request: Pick<EmployeeRequest, 'partialDay'>,
  t?: Translator
) {
  if (!request.partialDay || request.partialDay.mode === 'full-day') {
    return t?.('requestsUi.partialFullDay') ?? 'Full day'
  }

  const option = partialDayOptions.find(
    (item) => item.value === request.partialDay?.mode
  )

  if (request.partialDay.mode === 'custom') {
    return `${option && t ? t(option.labelKey) : (option?.label ?? 'Custom')} · ${request.partialDay.startTime ?? '-'} - ${request.partialDay.endTime ?? '-'}`
  }

  return option && t ? t(option.labelKey) : (option?.label ?? 'Partial day')
}

export function getAbsenceTypeOptions(
  attendanceTypes: AttendanceStatusType[]
): AbsenceTypeOption[] {
  return attendanceTypes.map((type) => ({
    code: type.code,
    label: type.label,
    value: type.id,
  }))
}

export function getRequestLabel({
  absenceType,
  bookingType,
  kind,
  officialType,
  t,
}: {
  absenceType?: AbsenceTypeOption
  bookingType: string
  kind: RequestKind
  officialType: string
  t?: Translator
}) {
  if (kind === 'absence') return absenceType?.label
  if (kind === 'booking') {
    const option = bookingTypes.find((item) => item.value === bookingType)
    return option && t ? t(option.labelKey) : option?.label
  }

  const option = officialTypes.find((item) => item.value === officialType)
  return option && t ? t(option.labelKey) : option?.label
}

export function getRequestDateLabel({
  fromDate,
  kind,
  locale,
  singleDate,
  toDate,
}: {
  fromDate: string
  kind: RequestKind
  locale: Locale
  singleDate: string
  toDate: string
}) {
  if (kind !== 'absence') return formatRequestDate(singleDate, locale)

  return `${formatRequestDate(fromDate, locale)} - ${formatRequestDate(toDate, locale)}`
}

export function mapRequestKind(kind: RequestKind): EmployeeRequestKind {
  if (kind === 'booking') return 'booking-correction'
  if (kind === 'official') return 'official-absence'

  return 'absence'
}

export function buildRequestDraftPreview({
  attachments,
  bookingType,
  clockIn,
  clockOut,
  fromDate,
  kind,
  officialType,
  partialDayMode,
  partialEndTime,
  partialStartTime,
  recurrenceFrequency,
  recurrenceOccurrences,
  remark,
  selectedAbsenceType,
  singleDate,
  toDate,
  viewer,
}: {
  attachments: RequestAttachment[]
  bookingType: string
  clockIn: string
  clockOut: string
  fromDate: string
  kind: RequestKind
  officialType: string
  partialDayMode: RequestPartialDayMode
  partialEndTime: string
  partialStartTime: string
  recurrenceFrequency: 'none' | 'weekly'
  recurrenceOccurrences: number
  remark: string
  selectedAbsenceType?: AbsenceTypeOption
  singleDate: string
  toDate: string
  viewer: AppViewer
}): RequestSubmissionDraft {
  const selectedLabel = getRequestLabel({
    absenceType: selectedAbsenceType,
    bookingType,
    kind,
    officialType,
  })

  return {
    attachments: attachments.length > 0 ? attachments : undefined,
    clockIn: kind !== 'absence' ? clockIn || undefined : undefined,
    clockOut: kind !== 'absence' ? clockOut || undefined : undefined,
    employeeId: viewer.employeeId,
    employeeName: viewer.name,
    fromDate: kind === 'absence' ? fromDate : singleDate,
    kind: mapRequestKind(kind),
    partialDay:
      kind === 'absence'
        ? {
            mode: partialDayMode,
            startTime:
              partialDayMode === 'custom' ? partialStartTime : undefined,
            endTime: partialDayMode === 'custom' ? partialEndTime : undefined,
          }
        : undefined,
    reason: remark,
    recurrence:
      kind === 'absence'
        ? {
            frequency: recurrenceFrequency,
            occurrences:
              recurrenceFrequency === 'weekly' ? recurrenceOccurrences : 1,
          }
        : undefined,
    statusCode: selectedAbsenceType?.code,
    statusLabel: selectedAbsenceType?.label,
    statusTypeId: selectedAbsenceType?.value,
    subtype: selectedLabel ?? requestKindLabels[mapRequestKind(kind)],
    toDate: kind === 'absence' ? toDate : singleDate,
  }
}

export function canSubmitRequestDraft({
  bookingType,
  clockIn,
  clockOut,
  fromDate,
  hasBlockingPolicyIssue,
  kind,
  officialType,
  selectedAbsenceType,
  singleDate,
  toDate,
}: {
  bookingType: string
  clockIn: string
  clockOut: string
  fromDate: string
  hasBlockingPolicyIssue: boolean
  kind: RequestKind
  officialType: string
  selectedAbsenceType?: AbsenceTypeOption
  singleDate: string
  toDate: string
}) {
  const hasRequiredFields =
    kind === 'absence'
      ? !!fromDate && !!toDate && !!selectedAbsenceType
      : kind === 'booking'
        ? !!singleDate && !!bookingType && (!!clockIn || !!clockOut)
        : // A partial official absence is only meaningful with its window. The
          // form asks for both times whenever the type is not a complete day, so
          // submitting them empty would record an absence covering nothing.
          !!singleDate &&
          !!officialType &&
          (officialType === 'full-day' || (!!clockIn && !!clockOut))

  return hasRequiredFields && !hasBlockingPolicyIssue
}

export function toRequestRow({
  employee,
  request,
  statusType,
  viewer,
}: {
  employee: EmployeeUser
  request: EmployeeRequest
  statusType?: AttendanceStatusType
  viewer: AppViewer
}): RequestRow {
  const view = maskRequestForViewer({ employee, request, statusType, viewer })

  return {
    id: request.id,
    date: request.submittedAt,
    details: view.details,
    owner: view.employeeName,
    request,
    status: request.status,
    type: requestKindLabels[request.kind],
    view,
  }
}

export function buildRequestRows({
  attendanceTypes,
  requests,
  users,
  viewer,
}: {
  attendanceTypes: AttendanceStatusType[]
  requests: EmployeeRequest[]
  users: EmployeeUser[]
  viewer: AppViewer
}) {
  const employeeById = new Map(users.map((user) => [user.id, user]))
  const statusTypeById = new Map(attendanceTypes.map((type) => [type.id, type]))
  const statusTypeByCode = new Map(
    attendanceTypes.map((type) => [type.code, type])
  )

  return requests
    .map((request) => {
      const employee = employeeById.get(request.employeeId)

      if (!employee) return null

      return toRequestRow({
        employee,
        request,
        statusType:
          (request.statusTypeId
            ? statusTypeById.get(request.statusTypeId)
            : undefined) ?? statusTypeByCode.get(request.statusCode ?? ''),
        viewer,
      })
    })
    .filter((row): row is RequestRow => !!row)
}

export function getApprovalRows({
  employeeById,
  rows,
  viewer,
}: {
  employeeById: Map<string, EmployeeUser>
  rows: RequestRow[]
  viewer: AppViewer
}) {
  const canReviewRequests =
    viewer.role === 'manager' || canViewFullAudit(viewer)
  const managedTeams = new Set(getViewerManagedTeams(viewer))

  return rows.filter((row) => {
    const currentStep = getCurrentApprovalStep(row.request.approvalFlow)
    const isAssignedApprover = currentStep?.approverIds.includes(
      viewer.employeeId
    )

    return (
      canReviewRequests &&
      row.request.employeeId !== viewer.employeeId &&
      row.request.status === 'submitted' &&
      (!currentStep?.approverIds.length || isAssignedApprover) &&
      (isAssignedApprover ||
        canViewFullAudit(viewer) ||
        managedTeams.has(employeeById.get(row.request.employeeId)?.team ?? ''))
    )
  })
}

export function getApprovalEmployees(
  rows: RequestRow[]
): ApprovalEmployeeOption[] {
  return Array.from(
    new Map(
      rows.map((row) => [
        row.request.employeeId,
        {
          id: row.request.employeeId,
          name: row.request.employeeName,
        },
      ])
    ).values()
  )
}

export function filterApprovalRows({
  employeeFilter,
  kindFilter,
  rows,
}: {
  employeeFilter: string
  kindFilter: string
  rows: RequestRow[]
}) {
  return rows.filter((row) => {
    const matchesEmployee =
      employeeFilter === 'all' || row.request.employeeId === employeeFilter
    const matchesKind = kindFilter === 'all' || row.request.kind === kindFilter

    return matchesEmployee && matchesKind
  })
}

export function getHistoryRows({
  employeeById,
  rows,
  viewer,
}: {
  employeeById: Map<string, EmployeeUser>
  rows: RequestRow[]
  viewer: AppViewer
}) {
  const managedTeams = new Set(getViewerManagedTeams(viewer))
  return rows.filter(
    (row) =>
      row.request.status !== 'submitted' &&
      (row.request.employeeId === viewer.employeeId ||
        canViewFullAudit(viewer) ||
        (viewer.role === 'manager' &&
          managedTeams.has(
            employeeById.get(row.request.employeeId)?.team ?? ''
          )))
  )
}

export function filterHistoryRows({
  rows,
  search,
  t,
}: {
  rows: RequestRow[]
  search: string
  t?: Translator
}) {
  const needle = search.trim().toLowerCase()

  if (!needle) return rows

  return rows.filter((row) => {
    const localizedStatus = getStatusLabel(row.status, t)
    const localizedKind = getRequestKindLabel(row.request.kind, t)

    return [
      row.owner,
      localizedKind,
      row.type,
      row.details,
      localizedStatus,
      statusLabels[row.status],
      row.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}

/**
 * Projects an approval decision onto the request list for optimistic rendering.
 *
 * The approver's own row updates the instant they decide instead of after a
 * round-trip. Only the status is changed: the approval flow, audit trail, and
 * timestamps are the server's to compute, and the refresh that follows replaces
 * this projection with the authoritative record.
 */
export function applyDecisionToRequests(
  requests: EmployeeRequest[],
  ids: string[],
  decision: RequestDecision
): EmployeeRequest[] {
  const decided = new Set(ids)
  const status = decision === 'approve' ? 'approved' : 'rejected'

  return requests.map((request) =>
    decided.has(request.id) ? { ...request, status } : request
  )
}
