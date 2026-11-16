import type { EmployeeRequest } from '@/domain/requests/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAppliedTimeCorrectionFromRequest } from './corrections'

const approvedBookingCorrection: EmployeeRequest = {
  id: 'request-1',
  clockIn: '08:15',
  clockOut: '17:00',
  employeeId: 'employee-1',
  employeeName: 'Marta Lindgren',
  fromDate: '2026-05-24',
  kind: 'booking-correction',
  reason: 'Forgot to clock out.',
  status: 'approved',
  submittedAt: '2026-05-24T18:00:00.000Z',
  subtype: 'Add booking pair',
  syncState: 'synced',
  toDate: '2026-05-24',
  updatedAt: '2026-05-24T19:00:00.000Z',
  decision: {
    decidedAt: '2026-05-24T19:00:00.000Z',
    decidedById: 'manager-1',
    decidedByName: 'Anna Manager',
    decision: 'approve',
  },
}

describe('time corrections', () => {
  it('creates an applied correction from an approved booking request', () => {
    const correction = createAppliedTimeCorrectionFromRequest(
      approvedBookingCorrection
    )

    assert.equal(correction.id, 'correction-request-1')
    assert.equal(correction.requestId, approvedBookingCorrection.id)
    assert.equal(correction.date, '2026-05-24')
    assert.equal(correction.clockIn, '08:15')
    assert.equal(correction.clockOut, '17:00')
    assert.equal(correction.approvedByName, 'Anna Manager')
  })

  it('keeps the complete proposed event timeline on the applied correction', () => {
    const proposedEvents = [
      {
        id: 'clock-in-1',
        location: 'home-office' as const,
        occurredAt: '2026-05-24T08:00:00.000Z',
        type: 'clock-in' as const,
      },
      {
        id: 'clock-out-1',
        occurredAt: '2026-05-24T16:30:00.000Z',
        type: 'clock-out' as const,
      },
    ]
    const correction = createAppliedTimeCorrectionFromRequest({
      ...approvedBookingCorrection,
      proposedEvents,
    })

    assert.deepEqual(correction.proposedEvents, proposedEvents)
  })

  it('rejects submitted booking corrections', () => {
    assert.throws(
      () =>
        createAppliedTimeCorrectionFromRequest({
          ...approvedBookingCorrection,
          decision: undefined,
          status: 'submitted',
        }),
      /Only approved booking corrections/
    )
  })
})
