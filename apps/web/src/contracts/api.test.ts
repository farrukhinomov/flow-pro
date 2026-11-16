import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseApiAuthSessionDto,
  parseApiEmployeeRequestDto,
  parseApiOperationsHealthDto,
  parseApiSyncMetaDto,
  parseApiTimeBookingDto,
  parseApiUserDto,
} from './api'

test('api contracts: parses a valid user dto', () => {
  const parsed = parseApiUserDto({
    id: 'usr-1',
    firstName: 'Hannah',
    lastName: 'Fischer',
    username: 'hannah.fischer',
    email: 'hannah.fischer@example.com',
    status: 'active',
    role: 'employee',
    team: 'B2X',
    manager: 'Maja Manager',
    workPattern: 'Full-time',
    visibilityScope: 'team-operational',
    createdAt: '2026-05-31T09:00:00.000Z',
    updatedAt: '2026-05-31T09:00:00.000Z',
  })
  assert.equal(parsed.id, 'usr-1')
})

test('api contracts: rejects invalid request status dto', () => {
  assert.throws(() =>
    parseApiEmployeeRequestDto({
      id: 'req-1',
      kind: 'absence',
      employeeId: 'usr-1',
      employeeName: 'Hannah Fischer',
      fromDate: '2026-06-01',
      toDate: '2026-06-02',
      subtype: 'Vacation',
      status: 'done',
      submittedAt: '2026-05-31T09:00:00.000Z',
      updatedAt: '2026-05-31T09:00:00.000Z',
      syncState: 'pending',
    })
  )
})

test('api contracts: parses backend auth session dto', () => {
  const parsed = parseApiAuthSessionDto({
    tenantId: '01975fa8-7590-7000-8000-000000000001',
    tenantSlug: 'flowpro-tenant',
    tenantName: 'FlowPro Tenant',
    userId: '01975fa8-7590-7000-8000-000000000002',
    externalSubject: '01975fa8-7590-7000-8000-000000000002',
    email: 'founder@flowpro.local',
    displayName: 'Marta Lindgren',
    roles: ['superadmin'],
    permissions: ['attendance.clock.self', 'attendance.view.self'],
    managedTeams: ['Customer Success'],
  })

  assert.equal(parsed.roles[0], 'superadmin')
  assert.equal(parsed.permissions.length, 2)
  assert.deepEqual(parsed.managedTeams, ['Customer Success'])
})

test('api contracts: parses server time booking dto', () => {
  const parsed = parseApiTimeBookingDto({
    id: 'booking-1',
    employeeId: 'employee-1',
    type: 'clockIn',
    occurredAt: '2026-05-31T09:00:00.000+00:00',
    receivedAt: '2026-05-31T09:00:01.000+00:00',
    location: 'homeOffice',
    source: 'web',
    supersedesBookingId: null,
    correctionReason: null,
    deviceId: 'browser',
    deviceSequence: null,
    latitude: 52.52,
    longitude: 13.405,
    accuracyMeters: 30,
    isVoided: false,
  })

  assert.equal(parsed.type, 'clockIn')
  assert.equal(parsed.location, 'homeOffice')
  assert.equal(parsed.occurredAt, '2026-05-31T09:00:00.000+00:00')
})

test('api contracts: rejects invalid server time booking type', () => {
  assert.throws(() =>
    parseApiTimeBookingDto({
      id: 'booking-1',
      employeeId: 'employee-1',
      type: 'clock-in',
      occurredAt: '2026-05-31T09:00:00.000Z',
      receivedAt: '2026-05-31T09:00:01.000Z',
      source: 'web',
      isVoided: false,
    })
  )
})

test('api contracts: parses sync meta dto', () => {
  const parsed = parseApiSyncMetaDto({
    isOnline: true,
    pendingCount: 2,
    lastSyncedAt: '2026-05-31T09:00:00.000Z',
  })
  assert.equal(parsed.pendingCount, 2)
})

test('api contracts: parses operations health dto', () => {
  const parsed = parseApiOperationsHealthDto({
    auditEventCount: 18,
    clientAggregateCount: 42,
    failedOutboxCount: 0,
    generatedAt: '2026-06-14T09:00:00.000Z',
    lastAuditEventAt: '2026-06-14T08:55:00.000Z',
    lastOutboxError: null,
    lastProcessedOutboxAt: '2026-06-14T08:59:00.000Z',
    lastProjectionUpdatedAt: '2026-06-14T08:58:00.000Z',
    oldestPendingOutboxAt: null,
    pendingOutboxCount: 0,
    status: 'ok',
  })

  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.lastOutboxError, null)
})

test('api contracts: rejects invalid operations health status', () => {
  assert.throws(() =>
    parseApiOperationsHealthDto({
      auditEventCount: 18,
      clientAggregateCount: 42,
      failedOutboxCount: 0,
      generatedAt: '2026-06-14T09:00:00.000Z',
      pendingOutboxCount: 0,
      status: 'degraded',
    })
  )
})
