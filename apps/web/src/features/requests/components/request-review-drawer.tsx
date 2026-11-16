import { useEffect, useState } from 'react'
import type { AppViewer } from '@/domain/access/access-control'
import type { AttendanceStatusType } from '@/domain/attendance/types'
import { maskRequestForViewer } from '@/domain/privacy/gdpr'
import { evaluateRequestDraftPolicy } from '@/domain/requests/policy'
import type {
  AuditEvent,
  EmployeeRequest,
  RequestDecision,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { getRequestKindLabel, getStatusLabel } from '../request-view-model'
import {
  RequestAdjustmentForm,
  type AdjustmentState,
} from './request-review-drawer/adjustment-form'
import { RequestAuditTimeline } from './request-review-drawer/audit-timeline'
import { RequestPolicyWarnings } from './request-review-drawer/policy-warnings'
import { RequestReviewDetails } from './request-review-drawer/request-details'
import { RequestReviewHeader } from './request-review-drawer/review-header'

export function RequestReviewDrawer({
  allRequests,
  attendanceTypes,
  loadAuditTrail,
  onApproveAdjusted,
  onDecision,
  onOpenChange,
  request,
  users,
  viewer,
}: {
  allRequests: EmployeeRequest[]
  attendanceTypes: AttendanceStatusType[]
  loadAuditTrail: (id: string) => Promise<AuditEvent[]>
  onApproveAdjusted: (
    request: EmployeeRequest,
    adjustedDraft: RequestSubmissionDraft,
    comment?: string
  ) => Promise<void>
  onDecision: (
    request: EmployeeRequest,
    decision: RequestDecision,
    comment?: string
  ) => Promise<void>
  onOpenChange: (open: boolean) => void
  request: EmployeeRequest | null
  users: EmployeeUser[]
  viewer: AppViewer
}) {
  const { t } = useI18n()
  const [comment, setComment] = useState('')
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const [isDeciding, setIsDeciding] = useState<RequestDecision | null>(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [adjustment, setAdjustment] = useState<AdjustmentState>({
    adjustedClockIn: '',
    adjustedClockOut: '',
    adjustedFromDate: '',
    adjustedPartialEnd: '',
    adjustedPartialMode: 'full-day',
    adjustedPartialStart: '',
    adjustedToDate: '',
  })

  // Starts at null so a drawer that mounts already open still initializes its draft.
  const [reviewedRequest, setReviewedRequest] =
    useState<EmployeeRequest | null>(null)

  // A different request starts a fresh review. Resetting during render instead of in an
  // effect avoids rendering once with the previous request's comment and adjustment.
  if (request !== reviewedRequest) {
    setReviewedRequest(request)
    if (request) {
      setAdjustment({
        adjustedClockIn: request.clockIn ?? '',
        adjustedClockOut: request.clockOut ?? '',
        adjustedFromDate: request.fromDate,
        adjustedPartialEnd: request.partialDay?.endTime ?? '',
        adjustedPartialMode: request.partialDay?.mode ?? 'full-day',
        adjustedPartialStart: request.partialDay?.startTime ?? '',
        adjustedToDate: request.toDate,
      })
      setIsAuditLoading(true)
    } else {
      setAuditTrail([])
      setComment('')
      setIsAuditLoading(false)
      setIsAdjusting(false)
    }
  }

  useEffect(() => {
    if (!request) return

    let isMounted = true
    loadAuditTrail(request.id).then((events) => {
      if (isMounted) {
        setAuditTrail(events)
        setIsAuditLoading(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [loadAuditTrail, request])

  if (!request) return null

  const employee = users.find((user) => user.id === request.employeeId)
  const statusType =
    attendanceTypes.find((type) => type.id === request.statusTypeId) ??
    attendanceTypes.find((type) => type.code === request.statusCode)
  const requestView =
    employee && maskRequestForViewer({ employee, request, statusType, viewer })

  if (!employee || !requestView || requestView.visibility === 'hidden') {
    return (
      <FlowProDrawer
        open={!!request}
        onOpenChange={onOpenChange}
        title={t('requestsUi.reviewRequest')}
        description={t('requestsUi.hiddenByPrivacyPolicy')}
        status={t('requestsUi.protected')}
        meta={t('requestsUi.gdprPrivacyByDefault')}
        footer={
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('syncUi.cancel')}
          </Button>
        }
      >
        <Alert>
          <ShieldAlert className='h-4 w-4' />
          <AlertTitle>{t('requestsUi.detailsHidden')}</AlertTitle>
          <AlertDescription>
            {t('requestsUi.onlyHrAdminEmployeeCanView')}
          </AlertDescription>
        </Alert>
      </FlowProDrawer>
    )
  }

  const adjustedDraft: RequestSubmissionDraft = {
    approvalFlow: request.approvalFlow,
    attachments: request.attachments,
    clockIn:
      request.kind !== 'absence'
        ? adjustment.adjustedClockIn || undefined
        : undefined,
    clockOut:
      request.kind !== 'absence'
        ? adjustment.adjustedClockOut || undefined
        : undefined,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    fromDate: adjustment.adjustedFromDate || request.fromDate,
    kind: request.kind,
    partialDay:
      request.kind === 'absence'
        ? {
            mode: adjustment.adjustedPartialMode,
            startTime:
              adjustment.adjustedPartialMode === 'custom'
                ? adjustment.adjustedPartialStart
                : undefined,
            endTime:
              adjustment.adjustedPartialMode === 'custom'
                ? adjustment.adjustedPartialEnd
                : undefined,
          }
        : request.partialDay,
    reason: request.reason,
    recurrence: request.recurrence,
    statusCode: request.statusCode,
    statusLabel: request.statusLabel,
    statusTypeId: request.statusTypeId,
    subtype: request.subtype,
    toDate: adjustment.adjustedToDate || request.toDate,
  }
  const reviewPolicy = evaluateRequestDraftPolicy({
    draft: adjustedDraft,
    existingRequests: allRequests.filter((item) => item.id !== request.id),
  })
  const hasAdjustment =
    adjustedDraft.fromDate !== request.fromDate ||
    adjustedDraft.toDate !== request.toDate ||
    adjustedDraft.clockIn !== request.clockIn ||
    adjustedDraft.clockOut !== request.clockOut ||
    adjustedDraft.partialDay?.mode !== request.partialDay?.mode ||
    adjustedDraft.partialDay?.startTime !== request.partialDay?.startTime ||
    adjustedDraft.partialDay?.endTime !== request.partialDay?.endTime
  const decisionDisabled = !!isDeciding || request.status !== 'submitted'

  const decide = async (decision: RequestDecision) => {
    setIsDeciding(decision)
    try {
      await onDecision(request, decision, comment)
      setComment('')
    } finally {
      setIsDeciding(null)
    }
  }

  const approveAdjusted = async () => {
    setIsDeciding('approve')
    try {
      await onApproveAdjusted(request, adjustedDraft, comment)
      setComment('')
    } finally {
      setIsDeciding(null)
    }
  }

  return (
    <FlowProDrawer
      open={!!request}
      onOpenChange={onOpenChange}
      title={t('requestsUi.reviewRequest')}
      description={t('requestsUi.checkOperationalImpact')}
      status={getStatusLabel(request.status, t)}
      meta={`${requestView.employeeName} · ${getRequestKindLabel(request.kind, t)}`}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('syncUi.cancel')}
          </Button>
          <Button
            type='button'
            variant='outline'
            className='border-rose-200 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700'
            disabled={decisionDisabled || isAdjusting}
            onClick={() => void decide('reject')}
          >
            <XCircle className='h-4 w-4' />
            {isDeciding === 'reject'
              ? t('requestsUi.rejecting')
              : t('requestsUi.reject')}
          </Button>
          <Button
            type='button'
            className='bg-emerald-600 text-white hover:bg-emerald-700'
            disabled={
              decisionDisabled ||
              (isAdjusting &&
                (!hasAdjustment || reviewPolicy.blocking.length > 0))
            }
            onClick={() =>
              void (isAdjusting ? approveAdjusted() : decide('approve'))
            }
          >
            <CheckCircle2 className='h-4 w-4' />
            {isDeciding === 'approve'
              ? t('requestsUi.approving')
              : isAdjusting
                ? t('requestsUi.approveAdjusted')
                : t('requestsUi.approve')}
          </Button>
        </>
      }
    >
      <div className='space-y-5'>
        <RequestReviewHeader
          request={request}
          statusLabel={requestView.statusLabel ?? request.subtype}
          details={requestView.details}
        />
        <RequestReviewDetails request={request} requestView={requestView} />
        <RequestPolicyWarnings policy={reviewPolicy} />
        <RequestAdjustmentForm
          isAdjusting={isAdjusting}
          request={request}
          setIsAdjusting={setIsAdjusting}
          state={adjustment}
          setState={setAdjustment}
          hasAdjustment={hasAdjustment}
        />
        <div className='space-y-2'>
          <Label htmlFor='decision-comment'>
            {t('requestsUi.managerComment')}
          </Label>
          <Textarea
            id='decision-comment'
            rows={4}
            maxLength={240}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('requestsUi.optionalDecisionNote')}
            className='resize-none'
          />
          <div className='text-right text-xs text-muted-foreground'>
            {comment.length} / 240
          </div>
          {request.status !== 'submitted' && (
            <p className='text-xs text-muted-foreground'>
              {t('requestsUi.decisionActionsDisabled', {
                status: getStatusLabel(request.status, t).toLowerCase(),
              })}
            </p>
          )}
          {isAdjusting && !hasAdjustment && (
            <p className='text-xs text-muted-foreground'>
              {t('requestsUi.approveAdjustedHint')}
            </p>
          )}
          {isAdjusting && reviewPolicy.blocking.length > 0 && (
            <p className='text-xs text-rose-600'>
              {t('requestsUi.policyBlocksMustBeResolved')}
            </p>
          )}
        </div>
        <RequestAuditTimeline
          auditTrail={auditTrail}
          auditVisible={requestView.auditVisible}
          isLoading={isAuditLoading}
        />
      </div>
    </FlowProDrawer>
  )
}
