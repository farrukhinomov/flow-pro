import { FlowProApiError } from '@/data/api/http-client'
import type { ApiRequestWorkflowResult } from '@/data/api/request-workflows.api'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import type {
  AppliedTimeCorrection,
  AttendancePolicyConfig,
  AttendanceStatusType,
  ClockEvent,
  MonthlyTimesheetApproval,
} from '@/domain/attendance/types'
import type {
  AuditEvent,
  EmployeeRequest,
  RequestCommandResult,
} from '@/domain/requests/types'
import {
  deactivateEmployeeUserRecord,
  reactivateEmployeeUserRecord,
} from '@/domain/users/lifecycle'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAttendancePolicyWorkflowService,
  type AttendancePolicyWorkflowDependencies,
} from './attendance-policy-workflow'
import {
  createAttendanceWorkflowService,
  type AttendanceWorkflowDependencies,
} from './attendance-workflow'
import {
  createRequestWorkflowService,
  type RequestWorkflowDependencies,
} from './request-workflow'
import {
  createTimesheetWorkflowService,
  type TimesheetWorkflowDependencies,
} from './timesheet-workflow'
import {
  createUsersWorkflowService,
  type UsersWorkflowDependencies,
} from './users-workflow'

function createWriteEffectTracker() {
  const tracker = {
    notified: 0,
    synced: 0,
    async notifyLocalDataChanged() {
      tracker.notified += 1
    },
    async syncAttendanceOutbox() {
      tracker.synced += 1
    },
  }

  return tracker
}

function employee(overrides: Partial<EmployeeUser> = {}): EmployeeUser {
  return {
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    email: 'hannah.fischer@flowpro.test',
    firstName: 'Hannah',
    id: 'usr-hannah-fischer',
    lastName: 'Fischer',
    manager: 'Tobias Weber',
    phoneNumber: '+49 151 000000',
    role: 'employee',
    status: 'active',
    team: 'Support',
    updatedAt: new Date('2026-01-01T08:00:00.000Z'),
    username: 'hannah.fischer',
    visibilityScope: 'Availability only',
    workPattern: 'Full-time · Hybrid',
    ...overrides,
  }
}

function requestWorkflowResult(
  request: EmployeeRequest,
  sideEffects: ApiRequestWorkflowResult['sideEffects'] = []
): ApiRequestWorkflowResult<EmployeeRequest> {
  return {
    primary: {
      aggregate: 'request',
      aggregateId: request.id,
      isDeleted: false,
      payload: {
        ...request,
        syncState: 'synced',
      },
      serverVersion: 'server-version-1',
      updatedAt: request.updatedAt,
      ownerUserId: request.employeeId,
    },
    sideEffects,
    sync: {
      accepted: [
        {
          operationId: 'server-operation-1',
          serverVersion: 'server-version-1',
          syncedAt: request.updatedAt,
        },
      ],
      conflicts: [],
      rejected: [],
      serverTime: request.updatedAt,
    },
  }
}

describe('core product write flows', () => {
  it('clocks through a flexible workday through the attendance gateway', async () => {
    const events: ClockEvent[] = []
    const deps: AttendanceWorkflowDependencies = {
      async clock(input) {
        const event: ClockEvent = {
          id: `server-event-${events.length + 1}`,
          employeeId: input.employeeId,
          type: input.type,
          occurredAt: (input.now ?? new Date()).toISOString(),
          location: input.type === 'clock-in' ? input.location : undefined,
          source: 'user',
          syncState: 'synced',
        }
        events.push(event)

        return event
      },
      async correct(event) {
        const index = events.findIndex((item) => item.id === event.id)
        if (index >= 0) events[index] = event

        return event
      },
      async createManual(input) {
        const event: ClockEvent = {
          id: `server-event-${events.length + 1}`,
          employeeId: input.employeeId,
          type: input.type,
          occurredAt: input.occurredAt.toISOString(),
          location: input.location,
          source: 'manual',
          syncState: 'synced',
        }
        events.push(event)

        return event
      },
      async listEventsForDay(employeeId, day) {
        const isoDate = day.toISOString().slice(0, 10)

        return events.filter(
          (event) =>
            event.employeeId === employeeId &&
            event.occurredAt.startsWith(isoDate)
        )
      },
      async void(event) {
        const index = events.findIndex((item) => item.id === event.id)
        if (index >= 0) events.splice(index, 1)
      },
    }
    const service = createAttendanceWorkflowService(deps)
    const day = new Date('2026-05-25T12:00:00.000Z')

    await service.clock({
      day,
      employeeId: 'usr-hannah-fischer',
      location: 'office',
      now: new Date('2026-05-25T08:00:00.000Z'),
      type: 'clock-in',
    })
    await service.clock({
      day,
      employeeId: 'usr-hannah-fischer',
      now: new Date('2026-05-25T12:00:00.000Z'),
      type: 'start-break',
    })
    await service.clock({
      day,
      employeeId: 'usr-hannah-fischer',
      now: new Date('2026-05-25T12:30:00.000Z'),
      type: 'resume-work',
    })
    await service.clock({
      day,
      employeeId: 'usr-hannah-fischer',
      now: new Date('2026-05-25T16:30:00.000Z'),
      type: 'clock-out',
    })

    assert.deepEqual(
      events.map((event) => event.type),
      ['clock-in', 'start-break', 'resume-work', 'clock-out']
    )
    assert.ok(events.every((event) => event.syncState === 'synced'))
  })

  it('submits a correction request and applies it when a manager approves', async () => {
    const effects = createWriteEffectTracker()
    const requests = new Map<string, EmployeeRequest>()
    const auditEvents: AuditEvent[] = []
    const corrections: AppliedTimeCorrection[] = []
    const deps: RequestWorkflowDependencies = {
      ...effects,
      async getEmployeeRequest(id) {
        return requests.get(id)
      },
      async saveEmployeeRequestCommand(command: RequestCommandResult) {
        requests.set(command.request.id, command.request)
        auditEvents.push(command.auditEvent)
      },
      async upsertTimeCorrection(correction) {
        corrections.push(correction)
      },
    }
    const service = createRequestWorkflowService(deps)
    const [submitted] = await service.submitRequest({
      actor: {
        displayName: 'Hannah Fischer',
        employeeId: 'usr-hannah-fischer',
      },
      draft: {
        clockIn: '08:30',
        clockOut: '17:00',
        fromDate: '2026-05-25',
        kind: 'booking-correction',
        reason: 'Forgot terminal booking.',
        subtype: 'Add booking pair',
        toDate: '2026-05-25',
      },
    })

    assert.ok(submitted)

    const approved = await service.decideRequest({
      actor: {
        displayName: 'Tobias Weber',
        employeeId: 'usr-tobias-weber',
      },
      decision: 'approve',
      id: submitted.request.id,
    })

    assert.equal(approved.request.status, 'approved')
    assert.equal(corrections.length, 1)
    assert.equal(corrections[0].clockIn, '08:30')
    assert.equal(auditEvents.length, 2)
    assert.equal(effects.notified, 2)
    assert.equal(effects.synced, 2)
  })

  it('submits requests through the backend workflow before using local outbox', async () => {
    const effects = createWriteEffectTracker()
    const serverRequests = new Map<string, EmployeeRequest>()
    let localSaves = 0
    const deps: RequestWorkflowDependencies = {
      ...effects,
      async getEmployeeRequest(id) {
        return serverRequests.get(id)
      },
      async saveEmployeeRequestCommand() {
        localSaves += 1
      },
      async saveServerEmployeeRequest(request) {
        serverRequests.set(request.id, request)
      },
      server: {
        async adjustAndApproveRequest() {
          throw new Error('Unexpected adjust approval call.')
        },
        async cancelRequest() {
          throw new Error('Unexpected cancel call.')
        },
        async decideRequest() {
          throw new Error('Unexpected decision call.')
        },
        async submitRequest({ request }) {
          return requestWorkflowResult(request)
        },
      },
      async upsertTimeCorrection() {
        throw new Error('Unexpected correction call.')
      },
    }
    const service = createRequestWorkflowService(deps)

    const [submitted] = await service.submitRequest({
      actor: {
        displayName: 'Hannah Fischer',
        employeeId: 'usr-hannah-fischer',
      },
      draft: {
        fromDate: '2026-06-15',
        kind: 'absence',
        statusTypeId: 'vac',
        subtype: 'Vacation',
        toDate: '2026-06-16',
      },
    })

    assert.ok(submitted)
    assert.equal(localSaves, 0)
    assert.equal(serverRequests.get(submitted.request.id)?.syncState, 'synced')
    assert.equal(effects.notified, 1)
    assert.equal(effects.synced, 0)
  })

  it('falls back to local outbox when the backend workflow is unavailable', async () => {
    const effects = createWriteEffectTracker()
    const requests = new Map<string, EmployeeRequest>()
    let localSaves = 0
    const deps: RequestWorkflowDependencies = {
      ...effects,
      async getEmployeeRequest(id) {
        return requests.get(id)
      },
      async saveEmployeeRequestCommand(command) {
        localSaves += 1
        requests.set(command.request.id, command.request)
      },
      async saveServerEmployeeRequest() {
        throw new Error('Unexpected server cache write.')
      },
      server: {
        async adjustAndApproveRequest() {
          throw new Error('Unexpected adjust approval call.')
        },
        async cancelRequest() {
          throw new Error('Unexpected cancel call.')
        },
        async decideRequest() {
          throw new Error('Unexpected decision call.')
        },
        async submitRequest() {
          throw new FlowProApiError('FlowPro API is unavailable.')
        },
      },
      async upsertTimeCorrection() {
        throw new Error('Unexpected correction call.')
      },
    }
    const service = createRequestWorkflowService(deps)

    const [submitted] = await service.submitRequest({
      actor: {
        displayName: 'Hannah Fischer',
        employeeId: 'usr-hannah-fischer',
      },
      draft: {
        fromDate: '2026-06-15',
        kind: 'absence',
        statusTypeId: 'vac',
        subtype: 'Vacation',
        toDate: '2026-06-16',
      },
    })

    assert.ok(submitted)
    assert.equal(localSaves, 1)
    assert.equal(requests.get(submitted.request.id)?.syncState, 'pending')
    assert.equal(effects.notified, 1)
    assert.equal(effects.synced, 1)
  })

  it('adjusts and approves requests through the backend workflow', async () => {
    const effects = createWriteEffectTracker()
    const requests = new Map<string, EmployeeRequest>()
    const original: EmployeeRequest = {
      id: 'request-original',
      employeeId: 'usr-hannah-fischer',
      employeeName: 'Hannah Fischer',
      fromDate: '2026-06-15',
      kind: 'absence',
      status: 'submitted',
      statusTypeId: 'vac',
      subtype: 'Vacation',
      submittedAt: '2026-06-01T08:00:00.000Z',
      syncState: 'synced',
      toDate: '2026-06-16',
      updatedAt: '2026-06-01T08:00:00.000Z',
    }
    requests.set(original.id, original)

    const deps: RequestWorkflowDependencies = {
      ...effects,
      async getEmployeeRequest(id) {
        return requests.get(id)
      },
      async saveEmployeeRequestCommand() {
        throw new Error('Unexpected local save.')
      },
      async saveServerEmployeeRequest(request) {
        requests.set(request.id, request)
      },
      async saveServerWorkflowSideEffect(sideEffect) {
        if (
          sideEffect.aggregate === 'request' &&
          typeof sideEffect.payload === 'object' &&
          sideEffect.payload &&
          'id' in sideEffect.payload
        ) {
          requests.set(
            sideEffect.payload.id as string,
            sideEffect.payload as EmployeeRequest
          )
        }
      },
      server: {
        async adjustAndApproveRequest({ adjustedRequest }) {
          return requestWorkflowResult(
            {
              ...adjustedRequest,
              status: 'approved',
              syncState: 'synced',
            },
            [
              {
                aggregate: 'request',
                aggregateId: original.id,
                isDeleted: false,
                ownerUserId: original.employeeId,
                payload: {
                  ...original,
                  status: 'cancelled',
                  syncState: 'synced',
                },
                serverVersion: 'server-version-2',
                updatedAt: '2026-06-01T09:00:00.000Z',
              },
            ]
          )
        },
        async cancelRequest() {
          throw new Error('Unexpected cancel call.')
        },
        async decideRequest() {
          throw new Error('Unexpected decision call.')
        },
        async submitRequest() {
          throw new Error('Unexpected submit call.')
        },
      },
      async upsertTimeCorrection() {
        throw new Error('Unexpected correction call.')
      },
    }
    const service = createRequestWorkflowService(deps)

    const commands = await service.approveAdjustedRequest({
      actor: {
        displayName: 'Tobias Weber',
        employeeId: 'usr-tobias-weber',
      },
      adjustedDraft: {
        employeeId: 'usr-hannah-fischer',
        employeeName: 'Hannah Fischer',
        fromDate: '2026-06-15',
        kind: 'absence',
        statusTypeId: 'ho',
        subtype: 'Home office',
        toDate: '2026-06-15',
      },
      id: original.id,
    })

    const adjusted = commands.find(
      (command) => command.request.status === 'approved'
    )

    assert.ok(adjusted)
    assert.equal(requests.get(original.id)?.status, 'cancelled')
    assert.equal(requests.get(adjusted.request.id)?.status, 'approved')
    assert.equal(effects.notified, 1)
    assert.equal(effects.synced, 0)
  })

  it('keeps user lifecycle writes behind the users workflow service', async () => {
    const effects = createWriteEffectTracker()
    const users = new Map<string, EmployeeUser>()
    const deps: UsersWorkflowDependencies = {
      ...effects,
      async cacheEmployeeUser(user) {
        users.set(user.id, user)
      },
      async deactivateEmployeeUser(input) {
        const nextUser = deactivateEmployeeUserRecord(input)
        users.set(nextUser.id, nextUser)

        return nextUser
      },
      async deactivateUserWorkflow({ user }) {
        return deactivateEmployeeUserRecord({ user })
      },
      async inviteEmployeeUser({
        email,
        role,
      }: {
        email: string
        note?: string
        role: UserRole
      }) {
        const username = email.split('@')[0] ?? email
        const user = employee({
          email,
          id: `usr-${username}`,
          role,
          status: 'invited',
          username,
        })

        users.set(user.id, user)

        return user
      },
      async inviteUserWorkflow({ email, role }) {
        const username = email.split('@')[0] ?? email
        return employee({
          email,
          id: `usr-${username}`,
          role,
          status: 'invited',
          username,
        })
      },
      async reactivateEmployeeUser(user) {
        const nextUser = reactivateEmployeeUserRecord(user)
        users.set(nextUser.id, nextUser)

        return nextUser
      },
      async reactivateUserWorkflow(user) {
        return reactivateEmployeeUserRecord(user)
      },
      async saveUserWorkflow(user) {
        return user
      },
      shouldFallbackToLocalUsers() {
        return false
      },
      async upsertEmployeeUser(user) {
        users.set(user.id, user)
      },
    }
    const service = createUsersWorkflowService(deps)
    const savedUser = employee()

    await service.saveUser(savedUser)
    const inactiveUser = await service.deactivateUser({
      actorId: 'usr-marta-lindgren',
      reason: 'Left company',
      user: savedUser,
    })
    const activeUser = await service.reactivateUser(inactiveUser)
    const invitedUser = await service.inviteUser({
      email: 'new.employee@flowpro.test',
      role: 'employee',
    })

    assert.equal(users.get(savedUser.id)?.status, 'active')
    assert.equal(activeUser.status, 'active')
    assert.equal(invitedUser.status, 'invited')
    assert.equal(effects.notified, 4)
    assert.equal(effects.synced, 0)
  })

  it('saves attendance policy and status type writes consistently', async () => {
    const effects = createWriteEffectTracker()
    let config: AttendancePolicyConfig = getDefaultAttendancePolicyConfig()
    const types = new Map<string, AttendanceStatusType>()
    const deps: AttendancePolicyWorkflowDependencies = {
      ...effects,
      async cacheAttendancePolicyConfig(nextConfig) {
        config = nextConfig
      },
      async publishAttendancePolicyConfigWorkflow(nextConfig) {
        config = {
          ...nextConfig,
          updatedAt: '2026-05-25T09:00:00.000Z',
        }

        return config
      },
      async removeAttendanceType(id) {
        types.delete(id)
      },
      shouldFallbackToLocalAttendancePolicy() {
        return false
      },
      async upsertAttendancePolicyConfig(nextConfig) {
        config = nextConfig

        return config
      },
      async upsertAttendanceType(type) {
        types.set(type.id, type)
      },
    }
    const service = createAttendancePolicyWorkflowService(deps)
    const homeOffice: AttendanceStatusType = {
      adminVisibility: 'full',
      auditRequired: true,
      category: 'remote',
      code: 'HO',
      color: '#d946ef',
      id: 'type-ho',
      label: 'Home office',
      managerVisibility: 'operational',
      requiresApproval: false,
      teammateVisibility: 'state-only',
      updatedAt: '2026-05-25T08:00:00.000Z',
    }

    await service.saveType(homeOffice)
    await service.deleteType(homeOffice.id)
    await service.saveConfig({
      ...config,
      vacationAnnualDays: 32,
    })

    assert.equal(types.has(homeOffice.id), false)
    assert.equal(config.vacationAnnualDays, 32)
    assert.equal(effects.notified, 3)
    assert.equal(effects.synced, 2)
  })

  it('signs and exports a monthly timesheet through one workflow service', async () => {
    const effects = createWriteEffectTracker()
    const approvals = new Map<string, MonthlyTimesheetApproval>()
    const serverSideEffects: unknown[] = []
    const deps: TimesheetWorkflowDependencies = {
      ...effects,
      async cacheTimesheetApproval(approval) {
        approvals.set(approval.id, approval)
      },
      async createPayrollExportWorkflow(input) {
        return {
          primary: {
            aggregate: 'payroll-export',
            aggregateId: 'payroll-export-2026-05',
            isDeleted: false,
            ownerUserId: 'usr-tobias-weber',
            payload: {
              id: 'payroll-export-2026-05',
              createdAt: '2026-05-31T13:00:00.000Z',
              format: input.format,
              period: input.period,
              requestedByName: 'Tobias Weber',
              requestedByUserId: 'usr-tobias-weber',
              scope: input.scope,
              status: 'ready',
              syncState: 'synced',
              updatedAt: '2026-05-31T13:00:00.000Z',
            },
            serverVersion: '1',
            updatedAt: '2026-05-31T13:00:00.000Z',
          },
          sideEffects: [],
          sync: {
            accepted: [],
            conflicts: [],
            rejected: [],
            serverTime: '2026-05-31T13:00:00.000Z',
          },
        }
      },
      async markTimesheetExported(approval, kind) {
        const nextApproval: MonthlyTimesheetApproval = {
          ...approval,
          payrollExportedAt:
            kind === 'payroll'
              ? '2026-05-31T13:00:00.000Z'
              : approval.payrollExportedAt,
          pdfExportedAt:
            kind === 'pdf'
              ? '2026-05-31T13:00:00.000Z'
              : approval.pdfExportedAt,
          updatedAt: '2026-05-31T13:00:00.000Z',
        }

        approvals.set(nextApproval.id, nextApproval)

        return nextApproval
      },
      async markTimesheetExportedWorkflow({ employeeId, kind, periodMonth }) {
        const approval = approvals.get(`${employeeId}-${periodMonth}`)
        assert.ok(approval)

        return {
          ...approval,
          payrollExportedAt:
            kind === 'payroll'
              ? '2026-05-31T13:00:00.000Z'
              : approval.payrollExportedAt,
          pdfExportedAt:
            kind === 'pdf'
              ? '2026-05-31T13:00:00.000Z'
              : approval.pdfExportedAt,
          updatedAt: '2026-05-31T13:00:00.000Z',
        }
      },
      async saveServerWorkflowSideEffect(item) {
        serverSideEffects.push(item)
      },
      async signTimesheetApproval(input) {
        const approval: MonthlyTimesheetApproval = {
          employeeId: input.employeeId,
          id: `${input.employeeId}-${input.periodMonth}`,
          note: input.note,
          periodMonth: input.periodMonth,
          signedAt: '2026-05-31T12:00:00.000Z',
          signedById: input.signedById,
          signedByName: input.signedByName,
          status: 'signed',
          updatedAt: '2026-05-31T12:00:00.000Z',
        }

        approvals.set(approval.id, approval)

        return approval
      },
      async signTimesheetApprovalWorkflow(input) {
        const approval: MonthlyTimesheetApproval = {
          employeeId: input.employeeId,
          id: `${input.employeeId}-${input.periodMonth}`,
          note: input.note,
          periodMonth: input.periodMonth,
          signedAt: '2026-05-31T12:00:00.000Z',
          signedById: input.signedById,
          signedByName: input.signedByName,
          status: 'signed',
          updatedAt: '2026-05-31T12:00:00.000Z',
        }

        return approval
      },
      shouldFallbackToLocalTimesheet() {
        return false
      },
    }
    const service = createTimesheetWorkflowService(deps)
    const signed = await service.signMonthlyTimesheet({
      employeeId: 'usr-hannah-fischer',
      note: 'Ready for payroll.',
      periodMonth: '2026-05',
      signedById: 'usr-tobias-weber',
      signedByName: 'Tobias Weber',
    })
    const exported = await service.markExported({
      approval: signed,
      kind: 'payroll',
    })

    assert.equal(signed.status, 'signed')
    assert.equal(exported.payrollExportedAt, '2026-05-31T13:00:00.000Z')
    assert.equal(serverSideEffects.length, 1)
    assert.equal(effects.notified, 3)
    assert.equal(effects.synced, 0)
  })
})
