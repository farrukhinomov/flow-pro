import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRequestApprovalFlow } from './approval-routing'
import {
  createRequestDecisionCommand,
  createRequestSubmitCommand,
} from './commands'

function user(
  id: string,
  name: string,
  role: EmployeeUser['role'],
  manager: string
): EmployeeUser {
  const [firstName, ...last] = name.split(' ')
  return {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: `${id}@flowpro.local`,
    firstName,
    id,
    lastName: last.join(' '),
    manager,
    phoneNumber: '',
    role,
    status: 'active',
    team: role === 'employee' ? 'Product' : 'Management',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    username: id,
    visibilityScope: '',
    workPattern: 'Full-time',
  }
}

describe('request approval routing', () => {
  it('routes leave through the named lead and then their manager', () => {
    const employee = user('employee', 'Eva Employee', 'employee', 'Lena Lead')
    const lead = user('lead', 'Lena Lead', 'manager', 'Max Manager')
    const manager = user('manager', 'Max Manager', 'manager', 'Board')
    const flow = buildRequestApprovalFlow({
      attendanceTypes: [
        {
          adminVisibility: 'full',
          auditRequired: true,
          category: 'leave',
          code: 'VAC',
          color: '#000',
          id: 'vac',
          label: 'Vacation',
          managerVisibility: 'operational',
          requiresApproval: true,
          teammateVisibility: 'state-only',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      config: getDefaultAttendancePolicyConfig(),
      draft: { kind: 'absence', statusTypeId: 'vac' },
      employee,
      users: [employee, lead, manager],
    })

    assert.deepEqual(
      flow.steps.map((step) => step.approverNames),
      [['Lena Lead'], ['Max Manager']]
    )
  })

  it('keeps a request submitted until the final approval step', () => {
    const submitted = createRequestSubmitCommand({
      draft: {
        approvalFlow: {
          currentStepIndex: 0,
          steps: [
            {
              approverIds: ['lead'],
              approverNames: ['Lena Lead'],
              decisions: [],
              id: 'lead',
              label: 'Team lead',
              requireAll: false,
              status: 'pending',
            },
            {
              approverIds: ['manager'],
              approverNames: ['Max Manager'],
              decisions: [],
              id: 'manager',
              label: 'Manager',
              requireAll: false,
              status: 'pending',
            },
          ],
        },
        employeeId: 'employee',
        employeeName: 'Eva Employee',
        fromDate: '2026-06-10',
        kind: 'absence',
        statusTypeId: 'vac',
        subtype: 'Vacation',
        toDate: '2026-06-10',
      },
    }).request
    const leadApproved = createRequestDecisionCommand({
      actorId: 'lead',
      actorName: 'Lena Lead',
      decision: 'approve',
      request: submitted,
    }).request
    const managerApproved = createRequestDecisionCommand({
      actorId: 'manager',
      actorName: 'Max Manager',
      decision: 'approve',
      request: leadApproved,
    }).request

    assert.equal(leadApproved.status, 'submitted')
    assert.equal(leadApproved.approvalFlow?.currentStepIndex, 1)
    assert.equal(managerApproved.status, 'approved')
  })

  it('falls back to an administrator when no manager or HR is assigned', () => {
    const employee = user('employee', 'Eva Employee', 'employee', 'Nobody')
    const admin = user('admin', 'Ada Admin', 'superadmin', 'Board')
    const flow = buildRequestApprovalFlow({
      attendanceTypes: [],
      config: getDefaultAttendancePolicyConfig(),
      draft: { kind: 'booking-correction' },
      employee,
      users: [employee, admin],
    })

    assert.deepEqual(flow.steps[0]?.approverNames, ['Ada Admin'])
    assert.equal(flow.steps[0]?.label, 'Administrator')
  })

  it('auto-approves booking corrections within the configured threshold', () => {
    const config = getDefaultAttendancePolicyConfig()
    config.approvalRules.autoApproveBookingCorrections = true
    config.approvalRules.autoApproveBookingCorrectionThresholdMinutes = 15

    const flow = buildRequestApprovalFlow({
      attendanceTypes: [],
      config,
      draft: {
        correctionDeltaMinutes: 10,
        kind: 'booking-correction',
      },
      users: [],
    })

    assert.equal(flow.autoApproved, true)
    assert.deepEqual(flow.steps, [])
  })

  it('routes booking corrections above the configured threshold', () => {
    const employee = user('employee', 'Eva Employee', 'employee', 'Nobody')
    const admin = user('admin', 'Ada Admin', 'superadmin', 'Board')
    const config = getDefaultAttendancePolicyConfig()
    config.approvalRules.autoApproveBookingCorrections = true
    config.approvalRules.autoApproveBookingCorrectionThresholdMinutes = 15

    const flow = buildRequestApprovalFlow({
      attendanceTypes: [],
      config,
      draft: {
        correctionDeltaMinutes: 20,
        kind: 'booking-correction',
      },
      employee,
      users: [employee, admin],
    })

    assert.equal(flow.autoApproved, undefined)
    assert.deepEqual(flow.steps[0]?.approverNames, ['Ada Admin'])
  })
})
