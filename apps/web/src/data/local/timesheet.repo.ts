import type {
  MonthlyTimesheetApproval,
  OutboxOperation,
} from '@/domain/attendance/types'
import { enqueueOutbox } from './attendance.repo'
import { appendAuditEvent } from './audit.repo'
import { getAllFromStore, getFromStore, putInStore } from './db'

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

function createTimesheetOperation(
  approval: MonthlyTimesheetApproval,
  type: 'timesheet.sign' | 'timesheet.export'
): OutboxOperation {
  return {
    id: createId('op'),
    type,
    aggregate: 'timesheet',
    aggregateId: approval.id,
    payload: approval,
    clientCreatedAt: approval.updatedAt,
    status: 'pending',
    attemptCount: 0,
  }
}

export async function getTimesheetApproval(
  employeeId: string,
  periodMonth: string
) {
  const id = `${employeeId}-${periodMonth}`
  const current = await getFromStore<MonthlyTimesheetApproval>(
    'timesheetApprovals',
    id
  )

  if (current) return current

  return {
    id,
    employeeId,
    periodMonth,
    status: 'open',
    updatedAt: new Date().toISOString(),
  } satisfies MonthlyTimesheetApproval
}

export async function listTimesheetApprovals(employeeId: string) {
  const approvals =
    await getAllFromStore<MonthlyTimesheetApproval>('timesheetApprovals')

  return approvals.filter((approval) => approval.employeeId === employeeId)
}

export async function listAllTimesheetApprovals() {
  return getAllFromStore<MonthlyTimesheetApproval>('timesheetApprovals')
}

export async function cacheTimesheetApproval(
  approval: MonthlyTimesheetApproval
) {
  await putInStore('timesheetApprovals', approval)
}

export async function signTimesheetApproval({
  employeeId,
  note,
  periodMonth,
  signedById,
  signedByName,
}: {
  employeeId: string
  note?: string
  periodMonth: string
  signedById: string
  signedByName: string
}) {
  const signedAt = new Date().toISOString()
  const approval: MonthlyTimesheetApproval = {
    id: `${employeeId}-${periodMonth}`,
    employeeId,
    note: note?.trim() || undefined,
    periodMonth,
    signedAt,
    signedById,
    signedByName,
    status: 'signed',
    updatedAt: signedAt,
  }

  await putInStore('timesheetApprovals', approval)
  await appendAuditEvent({
    id: `audit-timesheet-${approval.id}-signed`,
    aggregate: 'timesheet',
    aggregateId: approval.id,
    action: 'timesheet.signed',
    actorId: signedById,
    actorName: signedByName,
    classification: 'personal-data',
    createdAt: signedAt,
    metadata: {
      employeeId,
      periodMonth,
    },
    summary: `${signedByName} signed and locked ${periodMonth} for payroll.`,
  })
  await enqueueOutbox(createTimesheetOperation(approval, 'timesheet.sign'))

  return approval
}

export async function markTimesheetExported(
  approval: MonthlyTimesheetApproval,
  kind: 'payroll' | 'pdf'
) {
  const now = new Date().toISOString()
  const nextApproval: MonthlyTimesheetApproval = {
    ...approval,
    payrollExportedAt: kind === 'payroll' ? now : approval.payrollExportedAt,
    pdfExportedAt: kind === 'pdf' ? now : approval.pdfExportedAt,
    updatedAt: now,
  }

  await putInStore('timesheetApprovals', nextApproval)
  await appendAuditEvent({
    id: `audit-timesheet-${approval.id}-${kind}-${now}`,
    aggregate: 'timesheet',
    aggregateId: approval.id,
    action:
      kind === 'payroll'
        ? 'timesheet.payroll-exported'
        : 'timesheet.pdf-exported',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: 'personal-data',
    createdAt: now,
    metadata: {
      employeeId: approval.employeeId,
      kind,
      periodMonth: approval.periodMonth,
    },
    summary: `${approval.periodMonth} ${kind} export was generated.`,
  })
  await enqueueOutbox(
    createTimesheetOperation(nextApproval, 'timesheet.export')
  )

  return nextApproval
}
