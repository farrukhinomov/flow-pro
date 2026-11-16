import type { EmployeeRequest } from '@/domain/requests/types'
import type { AppliedTimeCorrection } from './types'

export function createAppliedTimeCorrectionFromRequest(
  request: EmployeeRequest
): AppliedTimeCorrection {
  if (request.kind !== 'booking-correction') {
    throw new Error('Only booking correction requests can be applied.')
  }

  if (request.status !== 'approved' || !request.decision) {
    throw new Error('Only approved booking corrections can be applied.')
  }

  return {
    id: `correction-${request.id}`,
    approvedAt: request.decision.decidedAt,
    approvedById: request.decision.decidedById,
    approvedByName: request.decision.decidedByName,
    clockIn: request.clockIn,
    clockOut: request.clockOut,
    proposedEvents: request.proposedEvents,
    createdAt: new Date().toISOString(),
    date: request.fromDate,
    employeeId: request.employeeId,
    reason: request.reason,
    requestId: request.id,
  }
}
