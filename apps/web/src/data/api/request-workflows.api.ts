import type {
  ApiDateTime,
  ApiSyncBatchResponseDto,
  ApiSyncOperationDto,
} from '@/contracts/api'
import type {
  EmployeeRequest,
  RequestDecision,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import { flowProApi } from './http-client'

export type ApiClientAggregateItem<TPayload = unknown> = {
  aggregate: ApiSyncOperationDto['aggregate']
  aggregateId: string
  payload: TPayload
  isDeleted: boolean
  serverVersion: string
  updatedAt: ApiDateTime
  ownerUserId?: string | null
}

export type ApiRequestWorkflowResult<TPrimary = EmployeeRequest> = {
  primary: ApiClientAggregateItem<TPrimary>
  sideEffects: ApiClientAggregateItem[]
  sync: ApiSyncBatchResponseDto
}

export type SubmitRequestWorkflowInput = {
  clientId?: string
  clientOperationId?: string
  request: EmployeeRequest
}

export type DecideRequestWorkflowInput = {
  clientId?: string
  clientOperationId?: string
  comment?: string
  decision: RequestDecision
  requestId: string
}

export type CancelRequestWorkflowInput = {
  clientId?: string
  clientOperationId?: string
  requestId: string
}

export type AdjustAndApproveRequestWorkflowInput = {
  adjustedRequest: EmployeeRequest
  clientId?: string
  clientOperationId?: string
  comment?: string
  requestId: string
}

export type CreatePayrollExportWorkflowInput = {
  clientId?: string
  clientOperationId?: string
  format: 'DATEV' | 'Excel' | 'Personio'
  period: string
  scope?: string
}

export async function submitRequestWorkflow({
  clientId,
  clientOperationId,
  request,
}: SubmitRequestWorkflowInput) {
  const response = await flowProApi.post<
    ApiRequestWorkflowResult<EmployeeRequest>
  >('/request-workflows', {
    requestId: request.id,
    kind: request.kind,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    fromDate: request.fromDate,
    toDate: request.toDate,
    subtype: request.subtype,
    statusTypeId: request.statusTypeId,
    statusCode: request.statusCode,
    statusLabel: request.statusLabel,
    clockIn: request.clockIn,
    clockOut: request.clockOut,
    proposedEvents: request.proposedEvents,
    partialDay: request.partialDay,
    recurrence: request.recurrence,
    attachments: request.attachments,
    reason: request.reason,
    approvalFlow: request.approvalFlow,
    clientId,
    clientOperationId,
  } satisfies RequestSubmissionDraft & {
    clientId?: string
    clientOperationId?: string
    requestId: string
  })

  return response.data
}

export async function decideRequestWorkflow({
  clientId,
  clientOperationId,
  comment,
  decision,
  requestId,
}: DecideRequestWorkflowInput) {
  const response = await flowProApi.post<
    ApiRequestWorkflowResult<EmployeeRequest>
  >(`/request-workflows/${encodeURIComponent(requestId)}/decision`, {
    decision,
    comment,
    clientId,
    clientOperationId,
  })

  return response.data
}

export async function cancelRequestWorkflow({
  clientId,
  clientOperationId,
  requestId,
}: CancelRequestWorkflowInput) {
  const response = await flowProApi.post<
    ApiRequestWorkflowResult<EmployeeRequest>
  >(`/request-workflows/${encodeURIComponent(requestId)}/cancel`, {
    clientId,
    clientOperationId,
  })

  return response.data
}

export async function adjustAndApproveRequestWorkflow({
  adjustedRequest,
  clientId,
  clientOperationId,
  comment,
  requestId,
}: AdjustAndApproveRequestWorkflowInput) {
  const response = await flowProApi.post<
    ApiRequestWorkflowResult<EmployeeRequest>
  >(`/request-workflows/${encodeURIComponent(requestId)}/adjust-and-approve`, {
    adjustedRequest: {
      requestId: adjustedRequest.id,
      kind: adjustedRequest.kind,
      employeeId: adjustedRequest.employeeId,
      employeeName: adjustedRequest.employeeName,
      fromDate: adjustedRequest.fromDate,
      toDate: adjustedRequest.toDate,
      subtype: adjustedRequest.subtype,
      statusTypeId: adjustedRequest.statusTypeId,
      statusCode: adjustedRequest.statusCode,
      statusLabel: adjustedRequest.statusLabel,
      clockIn: adjustedRequest.clockIn,
      clockOut: adjustedRequest.clockOut,
      proposedEvents: adjustedRequest.proposedEvents,
      partialDay: adjustedRequest.partialDay,
      recurrence: adjustedRequest.recurrence,
      attachments: adjustedRequest.attachments,
      reason: adjustedRequest.reason,
      approvalFlow: adjustedRequest.approvalFlow,
    },
    comment,
    clientId,
    clientOperationId,
  })

  return response.data
}

export async function createPayrollExportWorkflow(
  input: CreatePayrollExportWorkflowInput
) {
  const response = await flowProApi.post<ApiRequestWorkflowResult<unknown>>(
    '/payroll/workflows/exports',
    input
  )

  return response.data
}
