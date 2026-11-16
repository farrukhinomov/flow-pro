import {
  parseApiOperationsHealthDto,
  type ApiOperationsHealthDto,
  type ApiOperationsHealthStatus,
} from '@/contracts/api'
import { FlowProApiError, flowProApi } from './http-client'

export type OperationsHealthStatus = ApiOperationsHealthStatus

export type OperationsHealth = {
  auditEventCount: number
  clientAggregateCount: number
  failedOutboxCount: number
  generatedAt: string
  lastAuditEventAt?: string
  lastOutboxError?: string
  lastProcessedOutboxAt?: string
  lastProjectionUpdatedAt?: string
  oldestPendingOutboxAt?: string
  pendingOutboxCount: number
  status: OperationsHealthStatus
}

export async function getOperationsHealthWorkflow() {
  const response = await flowProApi.get<unknown>('/operations/health')

  return mapOperationsHealth(parseApiOperationsHealthDto(response.data))
}

export function shouldFallbackToLocalOperationsHealth(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

export function mapOperationsHealth(
  health: ApiOperationsHealthDto
): OperationsHealth {
  return {
    auditEventCount: health.auditEventCount,
    clientAggregateCount: health.clientAggregateCount,
    failedOutboxCount: health.failedOutboxCount,
    generatedAt: health.generatedAt,
    lastAuditEventAt: health.lastAuditEventAt ?? undefined,
    lastOutboxError: health.lastOutboxError ?? undefined,
    lastProcessedOutboxAt: health.lastProcessedOutboxAt ?? undefined,
    lastProjectionUpdatedAt: health.lastProjectionUpdatedAt ?? undefined,
    oldestPendingOutboxAt: health.oldestPendingOutboxAt ?? undefined,
    pendingOutboxCount: health.pendingOutboxCount,
    status: health.status,
  }
}
