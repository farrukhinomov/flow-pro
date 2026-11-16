import type { OutboxOperation } from '@/domain/attendance/types'
import { createAuditEvent } from '@/domain/audit/audit'
import { tStatic } from '@/i18n/static'
import type {
  AuditEvent,
  EmployeeRequest,
  RequestCommandResult,
  RequestDecision,
  RequestSubmissionDraft,
} from './types'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
const MAX_RECURRENCE_OCCURRENCES = 12

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

function addWeeksIsoDate(date: string, weeks: number) {
  const [year, month, day] = date.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day))
  nextDate.setUTCDate(nextDate.getUTCDate() + weeks * 7)

  return nextDate.toISOString().slice(0, 10)
}

function validateDraft(draft: RequestSubmissionDraft) {
  if (draft.toDate < draft.fromDate) {
    throw new Error(tStatic('requestsUi.validation.endDateBeforeStart'))
  }

  if (draft.kind === 'absence' && !draft.statusTypeId) {
    throw new Error(tStatic('requestsUi.validation.chooseStatusType'))
  }

  if (
    draft.kind === 'booking-correction' &&
    !draft.clockIn &&
    !draft.clockOut &&
    !draft.proposedEvents
  ) {
    throw new Error(tStatic('requestsUi.validation.addBookingTime'))
  }

  if (
    draft.partialDay?.mode === 'custom' &&
    (!draft.partialDay.startTime ||
      !draft.partialDay.endTime ||
      draft.partialDay.endTime <= draft.partialDay.startTime)
  ) {
    throw new Error(tStatic('requestsUi.validation.validPartialDayRange'))
  }

  const recurrence = draft.recurrence
  if (
    recurrence &&
    (recurrence.occurrences < 1 ||
      recurrence.occurrences > MAX_RECURRENCE_OCCURRENCES)
  ) {
    throw new Error(tStatic('requestsUi.validation.recurrenceRange'))
  }

  const oversizedAttachment = draft.attachments?.find(
    (attachment) => attachment.size > MAX_ATTACHMENT_SIZE_BYTES
  )
  if (oversizedAttachment) {
    throw new Error(tStatic('requestsUi.validation.attachmentSize'))
  }
}

export function createRequestSubmitCommand({
  draft,
  now = new Date(),
}: {
  draft: RequestSubmissionDraft
  now?: Date
}): RequestCommandResult {
  validateDraft(draft)

  const submittedAt = now.toISOString()
  const request: EmployeeRequest = {
    id: createId('request'),
    kind: draft.kind,
    employeeId: draft.employeeId,
    employeeName: draft.employeeName,
    fromDate: draft.fromDate,
    toDate: draft.toDate,
    statusTypeId: draft.statusTypeId,
    statusCode: draft.statusCode,
    statusLabel: draft.statusLabel,
    subtype: draft.subtype.trim(),
    clockIn: draft.clockIn,
    clockOut: draft.clockOut,
    proposedEvents: draft.proposedEvents,
    partialDay: draft.partialDay,
    recurrence: draft.recurrence,
    seriesId: draft.seriesId,
    attachments: draft.attachments,
    reason: draft.reason?.trim() || undefined,
    status: draft.approvalFlow?.autoApproved ? 'approved' : 'submitted',
    submittedAt,
    updatedAt: submittedAt,
    syncState: 'pending',
    approvalFlow: draft.approvalFlow,
    decision: draft.approvalFlow?.autoApproved
      ? {
          decision: 'approve',
          decidedAt: submittedAt,
          decidedById: 'system-auto-approval',
          decidedByName: 'Policy auto-approval',
        }
      : undefined,
  }

  return {
    request,
    auditEvent: createAuditEvent({
      aggregate: 'request',
      action: 'request.submitted',
      actorId: draft.employeeId,
      actorName: draft.employeeName,
      aggregateId: request.id,
      classification: 'personal-data',
      createdAt: submittedAt,
      summary: tStatic('requestsUi.auditSummaries.submitted', {
        employeeName: draft.employeeName,
        subtype: draft.subtype,
      }),
    }),
  }
}

export function createRequestSubmitCommands({
  draft,
  now = new Date(),
}: {
  draft: RequestSubmissionDraft
  now?: Date
}): RequestCommandResult[] {
  validateDraft(draft)

  const recurrence = draft.recurrence
  if (
    !recurrence ||
    recurrence.frequency === 'none' ||
    recurrence.occurrences <= 1
  ) {
    return [createRequestSubmitCommand({ draft, now })]
  }

  const seriesId = draft.seriesId ?? createId('series')

  return Array.from({ length: recurrence.occurrences }, (_, index) =>
    createRequestSubmitCommand({
      draft: {
        ...draft,
        fromDate: addWeeksIsoDate(draft.fromDate, index),
        toDate: addWeeksIsoDate(draft.toDate, index),
        seriesId,
      },
      now,
    })
  )
}

export function createRequestDecisionCommand({
  actorId,
  actorName,
  comment,
  decision,
  now = new Date(),
  request,
}: {
  actorId: string
  actorName: string
  comment?: string
  decision: RequestDecision
  now?: Date
  request: EmployeeRequest
}): RequestCommandResult {
  if (request.status !== 'submitted') {
    throw new Error(tStatic('requestsUi.validation.onlySubmittedCanBeDecided'))
  }

  const decidedAt = now.toISOString()
  const flow = request.approvalFlow
  const currentStep = flow?.steps[flow.currentStepIndex]

  if (
    currentStep &&
    currentStep.approverIds.length > 0 &&
    !currentStep.approverIds.includes(actorId)
  ) {
    throw new Error('This request is assigned to another approval step.')
  }

  const summary = {
    decision,
    decidedAt,
    decidedById: actorId,
    decidedByName: actorName,
    comment: comment?.trim() || undefined,
  }
  const currentDecisions = currentStep
    ? [...currentStep.decisions, summary]
    : [summary]
  const stepApproved =
    decision === 'approve' &&
    (!currentStep?.requireAll ||
      currentStep.approverIds.every((id) =>
        currentDecisions.some(
          (item) => item.decidedById === id && item.decision === 'approve'
        )
      ))
  const nextFlow = flow
    ? {
        ...flow,
        steps: flow.steps.map((step, index) =>
          index === flow.currentStepIndex
            ? {
                ...step,
                decisions: currentDecisions,
                status:
                  decision === 'reject'
                    ? ('rejected' as const)
                    : stepApproved
                      ? ('approved' as const)
                      : ('pending' as const),
              }
            : step
        ),
        currentStepIndex:
          stepApproved && flow.currentStepIndex < flow.steps.length - 1
            ? flow.currentStepIndex + 1
            : flow.currentStepIndex,
      }
    : undefined
  const hasNextStep =
    stepApproved &&
    !!nextFlow &&
    nextFlow.currentStepIndex < nextFlow.steps.length &&
    nextFlow.currentStepIndex !== flow?.currentStepIndex
  const status =
    decision === 'reject' ? 'rejected' : hasNextStep ? 'submitted' : 'approved'
  const nextRequest: EmployeeRequest = {
    ...request,
    status,
    updatedAt: decidedAt,
    decision: status === 'submitted' ? request.decision : summary,
    approvalFlow: nextFlow,
    syncState: 'pending',
  }

  return {
    request: nextRequest,
    auditEvent: createAuditEvent({
      aggregate: 'request',
      action: decision === 'approve' ? 'request.approved' : 'request.rejected',
      actorId,
      actorName,
      aggregateId: request.id,
      classification: 'personal-data',
      createdAt: decidedAt,
      summary: tStatic('requestsUi.auditSummaries.decided', {
        actorName,
        status: tStatic(`requests.status.${status}`),
        subtype: request.subtype,
      }),
    }),
  }
}

export function createRequestCancelCommand({
  actorId,
  actorName,
  now = new Date(),
  request,
}: {
  actorId: string
  actorName: string
  now?: Date
  request: EmployeeRequest
}): RequestCommandResult {
  if (request.status !== 'submitted') {
    throw new Error(
      tStatic('requestsUi.validation.onlySubmittedCanBeCancelled')
    )
  }

  const cancelledAt = now.toISOString()
  const nextRequest: EmployeeRequest = {
    ...request,
    status: 'cancelled',
    updatedAt: cancelledAt,
    syncState: 'pending',
  }

  return {
    request: nextRequest,
    auditEvent: createAuditEvent({
      aggregate: 'request',
      action: 'request.cancelled',
      actorId,
      actorName,
      aggregateId: request.id,
      classification: 'personal-data',
      createdAt: cancelledAt,
      summary: tStatic('requestsUi.auditSummaries.cancelled', {
        actorName,
        subtype: request.subtype,
      }),
    }),
  }
}

export function createRequestAdjustAndApproveCommands({
  adjustedDraft,
  actorId,
  actorName,
  comment,
  now = new Date(),
  request,
}: {
  adjustedDraft: RequestSubmissionDraft
  actorId: string
  actorName: string
  comment?: string
  now?: Date
  request: EmployeeRequest
}): RequestCommandResult[] {
  if (request.status !== 'submitted') {
    throw new Error(tStatic('requestsUi.validation.onlySubmittedCanBeAdjusted'))
  }

  const cancelled = createRequestCancelCommand({
    actorId,
    actorName,
    now,
    request,
  })
  const submitted = createRequestSubmitCommand({
    draft: adjustedDraft,
    now,
  })
  const adjustedAuditEvent: AuditEvent = {
    ...submitted.auditEvent,
    action: 'request.adjusted',
    actorId,
    actorName,
    summary: `${actorName} adjusted ${request.employeeName}'s ${request.subtype}.`,
  }
  const approved = createRequestDecisionCommand({
    actorId,
    actorName,
    comment:
      comment?.trim() ||
      `Approved with adjusted details from ${formatRequestRange(request)} to ${formatRequestRange(submitted.request)}.`,
    decision: 'approve',
    now,
    request: submitted.request,
  })

  return [
    {
      request: cancelled.request,
      auditEvent: {
        ...cancelled.auditEvent,
        summary: `${actorName} replaced ${request.employeeName}'s ${request.subtype} with adjusted details.`,
      },
    },
    {
      request: submitted.request,
      auditEvent: adjustedAuditEvent,
    },
    approved,
  ]
}

function formatRequestRange(
  request: Pick<EmployeeRequest, 'fromDate' | 'toDate' | 'clockIn' | 'clockOut'>
) {
  const dateRange =
    request.fromDate === request.toDate
      ? request.fromDate
      : `${request.fromDate} - ${request.toDate}`
  const times = [request.clockIn, request.clockOut].filter(Boolean).join(' - ')

  return times ? `${dateRange} (${times})` : dateRange
}

export function createRequestOperation(
  request: EmployeeRequest
): OutboxOperation {
  const action =
    request.status === 'approved'
      ? 'request.approve'
      : request.status === 'rejected'
        ? 'request.reject'
        : request.status === 'cancelled'
          ? 'request.cancel'
          : 'request.submit'

  return {
    id: createId('op'),
    type: action,
    aggregate: 'request',
    aggregateId: request.id,
    payload: request,
    clientCreatedAt: request.updatedAt,
    status: 'pending',
    attemptCount: 0,
  }
}
