import type { FlowProNotification } from '@/domain/notifications/types'
import type { PayrollExportRecord } from '@/domain/reports/payroll/types'
import type {
  ApprovedAbsenceRecord,
  EmployeeRequest,
} from '@/domain/requests/types'
import { deleteFromStore, putInStore } from './db'

export type WorkflowSideEffectAggregate =
  'absence' | 'notification' | 'payroll-export' | 'request'

export type WorkflowSideEffectItem = {
  aggregate: string
  aggregateId: string
  payload: unknown
}

export function isApprovedAbsenceRecord(
  payload: unknown
): payload is ApprovedAbsenceRecord {
  return (
    isRecordWithStringId(payload) &&
    'requestId' in payload &&
    'employeeId' in payload &&
    'fromDate' in payload &&
    'toDate' in payload &&
    'approvedAt' in payload
  )
}

export function isFlowProNotification(
  payload: unknown
): payload is FlowProNotification {
  return (
    isRecordWithStringId(payload) &&
    'recipientUserId' in payload &&
    'type' in payload &&
    'title' in payload &&
    'createdAt' in payload
  )
}

export function isPayrollExportRecord(
  payload: unknown
): payload is PayrollExportRecord {
  return (
    isRecordWithStringId(payload) &&
    'period' in payload &&
    'format' in payload &&
    'status' in payload &&
    'requestedByUserId' in payload
  )
}

export function isEmployeeRequestRecord(
  payload: unknown
): payload is EmployeeRequest {
  return (
    isRecordWithStringId(payload) &&
    'kind' in payload &&
    'status' in payload &&
    'submittedAt' in payload
  )
}

export async function saveWorkflowSideEffect(item: WorkflowSideEffectItem) {
  if (item.aggregate === 'absence' && isApprovedAbsenceRecord(item.payload)) {
    await putInStore('absences', { ...item.payload, syncState: 'synced' })
    return
  }

  if (
    item.aggregate === 'notification' &&
    isFlowProNotification(item.payload)
  ) {
    await putInStore('notifications', {
      ...item.payload,
      syncState: item.payload.syncState ?? 'synced',
    })
    return
  }

  if (
    item.aggregate === 'payroll-export' &&
    isPayrollExportRecord(item.payload)
  ) {
    await putInStore('payrollExports', {
      ...item.payload,
      syncState: 'synced',
    })
    return
  }

  if (item.aggregate === 'request' && isEmployeeRequestRecord(item.payload)) {
    await putInStore('employeeRequests', {
      ...item.payload,
      syncState: 'synced',
    })
  }
}

export async function deleteWorkflowSideEffect(
  aggregate: WorkflowSideEffectAggregate,
  aggregateId: string
) {
  if (aggregate === 'absence') {
    await deleteFromStore('absences', aggregateId)
  } else if (aggregate === 'notification') {
    await deleteFromStore('notifications', aggregateId)
  } else if (aggregate === 'payroll-export') {
    await deleteFromStore('payrollExports', aggregateId)
  } else if (aggregate === 'request') {
    await deleteFromStore('employeeRequests', aggregateId)
  }
}

function isRecordWithStringId(payload: unknown): payload is { id: string } {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'id' in payload &&
    typeof (payload as { id?: unknown }).id === 'string'
  )
}
