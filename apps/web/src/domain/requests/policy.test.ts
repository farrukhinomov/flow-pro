import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateRequestDraftPolicy } from './policy'
import type { EmployeeRequest, RequestSubmissionDraft } from './types'

const draft: RequestSubmissionDraft = {
  employeeId: 'employee-1',
  employeeName: 'Marta Lindgren',
  fromDate: '2026-06-01',
  kind: 'absence',
  statusCode: 'VAC',
  statusLabel: 'Vacation',
  statusTypeId: 'vac',
  subtype: 'Vacation',
  toDate: '2026-06-05',
}

const existingRequest: EmployeeRequest = {
  id: 'request-1',
  employeeId: 'employee-1',
  employeeName: 'Marta Lindgren',
  fromDate: '2026-06-03',
  kind: 'absence',
  status: 'approved',
  statusCode: 'VAC',
  statusLabel: 'Vacation',
  statusTypeId: 'vac',
  subtype: 'Vacation',
  submittedAt: '2026-05-24T08:00:00.000Z',
  syncState: 'synced',
  toDate: '2026-06-04',
  updatedAt: '2026-05-24T08:00:00.000Z',
}

describe('request policy evaluation', () => {
  it('blocks vacation requests that exceed available balance', () => {
    const result = evaluateRequestDraftPolicy({
      draft,
      existingRequests: [],
      vacationAvailableDays: 2,
    })

    assert.equal(result.blocking[0]?.code, 'vacation-balance')
  })

  it('warns before submitting overlapping own requests', () => {
    const result = evaluateRequestDraftPolicy({
      draft,
      existingRequests: [existingRequest],
    })

    assert.equal(result.warnings[0]?.code, 'own-request-conflict')
  })

  it('warns when recurring home office exceeds monthly policy target', () => {
    const result = evaluateRequestDraftPolicy({
      draft: {
        ...draft,
        fromDate: '2026-06-01',
        recurrence: { frequency: 'weekly', occurrences: 5 },
        statusCode: 'HO',
        statusLabel: 'Home office',
        toDate: '2026-06-02',
      },
      existingRequests: [],
      maxHomeOfficeDaysPerMonth: 8,
    })

    assert.equal(result.warnings[0]?.code, 'home-office-limit')
  })
})
