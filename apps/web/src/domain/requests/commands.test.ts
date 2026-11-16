import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createRequestAdjustAndApproveCommands,
  createRequestCancelCommand,
  createRequestDecisionCommand,
  createRequestSubmitCommand,
  createRequestSubmitCommands,
} from './commands'

const absenceDraft = {
  employeeId: 'employee-1',
  employeeName: 'Marta Lindgren',
  fromDate: '2026-06-01',
  kind: 'absence' as const,
  reason: 'Family time',
  statusLabel: 'Vacation',
  statusTypeId: 'vac',
  subtype: 'Vacation',
  toDate: '2026-06-03',
}

describe('request commands', () => {
  it('creates a submitted request and audit event', () => {
    const result = createRequestSubmitCommand({
      draft: absenceDraft,
      now: new Date('2026-05-24T08:00:00.000Z'),
    })

    assert.equal(result.request.status, 'submitted')
    assert.equal(result.request.syncState, 'pending')
    assert.equal(result.auditEvent.action, 'request.submitted')
  })

  it('expands weekly recurring absence requests into a shared series', () => {
    const results = createRequestSubmitCommands({
      draft: {
        ...absenceDraft,
        recurrence: { frequency: 'weekly', occurrences: 3 },
      },
      now: new Date('2026-05-24T08:00:00.000Z'),
    })

    assert.equal(results.length, 3)
    assert.equal(results[0].request.fromDate, '2026-06-01')
    assert.equal(results[1].request.fromDate, '2026-06-08')
    assert.equal(results[2].request.fromDate, '2026-06-15')
    assert.ok(results.every((result) => result.request.seriesId))
    assert.equal(results[0].request.seriesId, results[2].request.seriesId)
  })

  it('requires a valid custom partial-day time range', () => {
    assert.throws(
      () =>
        createRequestSubmitCommand({
          draft: {
            ...absenceDraft,
            partialDay: {
              mode: 'custom',
              startTime: '13:00',
              endTime: '09:00',
            },
          },
        }),
      /valid custom partial-day/
    )
  })

  it('stores manager decision comments on approval', () => {
    const submitted = createRequestSubmitCommand({
      draft: absenceDraft,
      now: new Date('2026-05-24T08:00:00.000Z'),
    }).request

    const result = createRequestDecisionCommand({
      actorId: 'manager-1',
      actorName: 'Anna Manager',
      comment: 'Coverage is fine.',
      decision: 'approve',
      now: new Date('2026-05-24T09:00:00.000Z'),
      request: submitted,
    })

    assert.equal(result.request.status, 'approved')
    assert.equal(result.request.decision?.comment, 'Coverage is fine.')
    assert.equal(result.auditEvent.action, 'request.approved')
  })

  it('cancels the original request and approves a replacement when adjusted', () => {
    const submitted = createRequestSubmitCommand({
      draft: absenceDraft,
      now: new Date('2026-05-24T08:00:00.000Z'),
    }).request

    const results = createRequestAdjustAndApproveCommands({
      actorId: 'manager-1',
      actorName: 'Anna Manager',
      adjustedDraft: {
        ...absenceDraft,
        fromDate: '2026-06-02',
        toDate: '2026-06-03',
      },
      comment: 'Adjusted to match coverage plan.',
      now: new Date('2026-05-24T10:00:00.000Z'),
      request: submitted,
    })

    assert.equal(results.length, 3)
    assert.equal(results[0].request.id, submitted.id)
    assert.equal(results[0].request.status, 'cancelled')
    assert.equal(results[1].auditEvent.action, 'request.adjusted')
    assert.notEqual(results[1].request.id, submitted.id)
    assert.equal(results[2].request.status, 'approved')
    assert.equal(
      results[2].request.decision?.comment,
      'Adjusted to match coverage plan.'
    )
  })

  it('blocks cancellation after a request was decided', () => {
    const submitted = createRequestSubmitCommand({
      draft: absenceDraft,
      now: new Date('2026-05-24T08:00:00.000Z'),
    }).request
    const approved = createRequestDecisionCommand({
      actorId: 'manager-1',
      actorName: 'Anna Manager',
      decision: 'approve',
      request: submitted,
    }).request

    assert.throws(
      () =>
        createRequestCancelCommand({
          actorId: 'employee-1',
          actorName: 'Marta Lindgren',
          request: approved,
        }),
      /Only submitted requests/
    )
  })
})
