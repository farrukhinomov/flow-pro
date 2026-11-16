import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canSignEmployeeTimesheet,
  canViewEmployeeTimesheet,
  canSeeRequestReason,
  getDataScope,
  getTimesheetVisibleEmployees,
  getVisibilityForScope,
  type AppViewer,
} from './access-control'

const employee: EmployeeUser = {
  id: 'employee-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'employee@flowpro.dev',
  firstName: 'Karl',
  lastName: 'Kaufmann',
  manager: 'Anna Queen',
  phoneNumber: '',
  role: 'employee',
  status: 'active',
  team: 'Operations',
  updatedAt: new Date('2026-05-24T00:00:00.000Z'),
  username: 'karl.kaufmann',
  visibilityScope: 'Availability only',
  workPattern: 'Full-time',
}
const baseRequest: EmployeeRequest = {
  id: 'request-1',
  employeeId: employee.id,
  employeeName: 'Karl Kaufmann',
  fromDate: '2026-06-01',
  kind: 'absence',
  reason: 'Private appointment',
  status: 'submitted',
  statusTypeId: 'off',
  subtype: 'Unavailable',
  submittedAt: '2026-05-24T08:00:00.000Z',
  syncState: 'synced',
  toDate: '2026-06-01',
  updatedAt: '2026-05-24T08:00:00.000Z',
}

describe('access control', () => {
  it('limits teammate visibility to state only', () => {
    const viewer: AppViewer = {
      id: 'viewer-1',
      employeeId: 'employee-2',
      name: 'Teammate',
      role: 'employee',
    }

    assert.equal(getDataScope({ employee, viewer }), 'availability-state')
    assert.equal(
      getVisibilityForScope({ scope: 'availability-state' }),
      'state-only'
    )
    assert.equal(
      canSeeRequestReason({ employee, request: baseRequest, viewer }),
      false
    )
  })

  it('lets managers see approved team request reasons only', () => {
    const viewer: AppViewer = {
      id: 'viewer-manager',
      employeeId: 'manager-1',
      managedTeam: 'Operations',
      name: 'Anna Manager',
      role: 'manager',
    }

    assert.equal(getDataScope({ employee, viewer }), 'team-operational')
    assert.equal(
      canSeeRequestReason({ employee, request: baseRequest, viewer }),
      false
    )
    assert.equal(
      canSeeRequestReason({
        employee,
        request: { ...baseRequest, status: 'approved' },
        viewer,
      }),
      true
    )
  })

  it('limits timesheet employee selection by viewer role and team', () => {
    const sameTeamEmployee = { ...employee, id: 'employee-1' }
    const otherTeamEmployee: EmployeeUser = {
      ...employee,
      id: 'employee-2',
      team: 'Sales',
    }
    const manager: AppViewer = {
      id: 'viewer-manager',
      employeeId: 'manager-1',
      managedTeam: 'Operations',
      name: 'Anna Manager',
      role: 'manager',
    }
    const employeeViewer: AppViewer = {
      id: 'viewer-employee',
      employeeId: sameTeamEmployee.id,
      name: 'Karl Employee',
      role: 'employee',
    }

    assert.equal(
      canViewEmployeeTimesheet({ employee: sameTeamEmployee, viewer: manager }),
      true
    )
    assert.equal(
      canViewEmployeeTimesheet({
        employee: otherTeamEmployee,
        viewer: manager,
      }),
      false
    )
    assert.deepEqual(
      getTimesheetVisibleEmployees({
        employees: [sameTeamEmployee, otherTeamEmployee],
        viewer: employeeViewer,
      }).map((visibleEmployee) => visibleEmployee.id),
      [sameTeamEmployee.id]
    )
    assert.equal(
      canSignEmployeeTimesheet({
        employee: sameTeamEmployee,
        viewer: manager,
      }),
      true
    )
    assert.equal(
      canSignEmployeeTimesheet({
        employee: sameTeamEmployee,
        viewer: employeeViewer,
      }),
      false
    )
  })
})
