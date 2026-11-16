import type { OutboxOperation } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  operationDescription,
  operationStatusLabel,
  operationTitle,
} from './sync-operation-labels'

const t = (key: string) => key

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    aggregateId: 'clock-1',
    createdAt: '2026-05-04T08:00:00.000Z',
    id: 'op-1',
    payload: {},
    status: 'pending',
    type: 'clock-event.create',
    updatedAt: '2026-05-04T08:00:00.000Z',
    ...overrides,
  } as OutboxOperation
}

describe('sync operation labels', () => {
  it('maps every known operation type to its own title key', () => {
    const types: OutboxOperation['type'][] = [
      'clock-event.create',
      'clock-event.update',
      'clock-event.delete',
      'request.submit',
      'request.approve',
      'request.reject',
      'request.cancel',
      'timesheet.sign',
      'timesheet.export',
      'user.invite',
      'user.upsert',
      'user.deactivate',
      'user.reactivate',
    ]
    const keys = types.map((type) => operationTitle(operation({ type }), t))

    assert.equal(
      new Set(keys).size,
      types.length,
      'each type needs a distinct title'
    )
    assert.ok(
      keys.every((key) => key.startsWith('syncUi.operationTitles.')),
      'titles must resolve inside the syncUi namespace'
    )
  })

  it('falls back to a generic title for an unknown type', () => {
    const unknown = operation({
      type: 'something.new' as OutboxOperation['type'],
    })

    assert.equal(operationTitle(unknown, t), 'syncUi.operationTitles.default')
  })

  it('describes each queue status distinctly', () => {
    // These are what a user reads when deciding whether to retry or resolve,
    // so a status must never borrow another status's description.
    const descriptions = (
      ['failed', 'conflict', 'syncing', 'pending'] as const
    ).map((status) => operationDescription(operation({ status }), t))

    assert.equal(new Set(descriptions).size, 4)
  })

  it('namespaces the status label by status', () => {
    assert.equal(
      operationStatusLabel('conflict', t),
      'syncUi.operationStatuses.conflict'
    )
  })
})
