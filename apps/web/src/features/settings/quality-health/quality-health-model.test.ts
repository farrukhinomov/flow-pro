import type { OutboxOperation, SyncMeta } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildQualityBugDashboard,
  buildQualityHealthSummary,
  type QualityHealthIssue,
} from './quality-health-model'

describe('quality health model', () => {
  it('reports healthy when operational signals are clean', () => {
    const result = buildQualityHealthSummary({
      auditIntegrityValid: true,
      operations: [],
      operationsHealth: null,
      syncMeta: createSyncMeta(),
    })

    assert.equal(result.severity, 'ok')
    assert.equal(result.score, 100)
    assert.equal(result.openIssueCount, 0)
  })

  it('treats audit integrity and failed outbox as critical', () => {
    const result = buildQualityHealthSummary({
      auditIntegrityValid: false,
      operations: [createOutboxOperation('failed')],
      operationsHealth: null,
      syncMeta: createSyncMeta({ pendingCount: 1 }),
    })

    assert.equal(result.severity, 'critical')
    assert.equal(result.auditIntegritySeverity, 'critical')
    assert.equal(result.failedOutboxCount, 1)
    assert.equal(result.pendingOutboxCount, 1)
    assert.ok(result.score < 60)
  })

  it('counts projection hydration errors', () => {
    const result = buildQualityHealthSummary({
      auditIntegrityValid: true,
      operations: [],
      operationsHealth: null,
      syncMeta: createSyncMeta({
        projectionHydration: {
          requests: {
            itemCount: 0,
            lastError: 'Feed failed.',
          },
        },
      }),
    })

    assert.equal(result.severity, 'critical')
    assert.equal(result.projectionErrorCount, 1)
  })

  it('includes backend operations health in quality scoring', () => {
    const result = buildQualityHealthSummary({
      auditIntegrityValid: true,
      operations: [],
      operationsHealth: {
        auditEventCount: 10,
        clientAggregateCount: 20,
        failedOutboxCount: 1,
        generatedAt: '2026-06-14T08:00:00.000Z',
        lastOutboxError: 'Dispatcher failed.',
        pendingOutboxCount: 1,
        status: 'critical',
      },
      syncMeta: createSyncMeta(),
    })

    assert.equal(result.serverHealthStatus, 'critical')
    assert.equal(result.severity, 'critical')
    assert.ok(result.score < 100)
  })

  it('builds a bug dashboard from quality issues', () => {
    const issues: QualityHealthIssue[] = [
      {
        descriptionKey: 'description',
        id: 'failed-outbox',
        severity: 'critical',
        titleKey: 'title',
      },
      {
        descriptionKey: 'description',
        id: 'server-health-unavailable',
        severity: 'warning',
        titleKey: 'title',
      },
    ]

    const result = buildQualityBugDashboard({ issues })

    assert.equal(result.openBugCount, 2)
    assert.equal(result.highSeverityCount, 1)
    assert.equal(result.normalSeverityCount, 1)
    assert.equal(result.severity, 'critical')
    assert.deepEqual(result.productAreas, [
      'Deployment and operations',
      'Sync and local cache',
    ])
  })

  it('prefers confirmed bug records over inferred quality issues', () => {
    const result = buildQualityBugDashboard({
      bugs: [
        {
          createdAt: '2026-06-10T08:00:00.000Z',
          id: 'bug-1',
          owner: 'Ops',
          productArea: 'Reports',
          severity: 'high',
          status: 'open',
          summary: 'Payroll export mismatch',
          updatedAt: '2026-06-10T08:00:00.000Z',
        },
      ],
      issues: [],
      now: new Date('2026-06-14T08:00:00.000Z'),
    })

    assert.equal(result.openBugCount, 1)
    assert.equal(result.highSeverityCount, 1)
    assert.equal(result.oldestOpenAgeDays, 4)
    assert.deepEqual(result.productAreas, ['Reports'])
  })
})

function createSyncMeta(overrides: Partial<SyncMeta> = {}): SyncMeta {
  return {
    isOnline: true,
    key: 'attendance-sync',
    pendingCount: 0,
    ...overrides,
  }
}

function createOutboxOperation(
  status: OutboxOperation['status']
): OutboxOperation {
  return {
    aggregate: 'request',
    aggregateId: 'request-1',
    attemptCount: 1,
    clientCreatedAt: '2026-06-14T08:00:00.000Z',
    id: 'operation-1',
    payload: {},
    status,
    type: 'request.submit',
  }
}
