import type { AppViewer } from '@/domain/access/access-control'
import { getDefaultAttendanceTypes } from '@/domain/attendance/policies'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { maskRequestForViewer } from './gdpr'

const employee: EmployeeUser = {
  id: 'usr-karl',
  firstName: 'Karl',
  lastName: 'Kaufmann',
  username: 'karl.kaufmann',
  email: 'karl@flowpro.dev',
  phoneNumber: '',
  status: 'active',
  role: 'employee',
  team: 'Operations',
  manager: 'Anna Queen',
  workPattern: 'Full-time',
  visibilityScope: 'Availability only',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const request: EmployeeRequest = {
  id: 'req-1',
  kind: 'absence',
  employeeId: employee.id,
  employeeName: 'Karl Kaufmann',
  fromDate: '2026-06-01',
  toDate: '2026-06-02',
  statusTypeId: 'sick',
  statusCode: 'SICK',
  statusLabel: 'Sick leave',
  subtype: 'Sick leave',
  reason: 'Medical appointment',
  attachments: [
    {
      id: 'att-1',
      addedAt: '2026-05-24T08:00:00.000Z',
      name: 'doctor-note.pdf',
      size: 1000,
      type: 'application/pdf',
    },
  ],
  status: 'submitted',
  submittedAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
  syncState: 'synced',
}

const manager: AppViewer = {
  id: 'viewer-manager',
  employeeId: 'usr-manager',
  managedTeam: 'Operations',
  name: 'Anna Queen',
  role: 'manager',
}

const teammate: AppViewer = {
  id: 'viewer-team',
  employeeId: 'usr-team',
  managedTeam: 'Operations',
  name: 'Team Mate',
  role: 'employee',
}

describe('gdpr request masking', () => {
  it('hides sickness reasons and attachments from managers', () => {
    const view = maskRequestForViewer({
      employee,
      request,
      statusType: getDefaultAttendanceTypes().find(
        (type) => type.id === 'sick'
      ),
      viewer: manager,
    })

    assert.equal(view.reason, undefined)
    assert.equal(view.attachments.length, 0)
    assert.equal(view.visibility, 'state-only')
  })

  it('hides sensitive requests from teammates', () => {
    const view = maskRequestForViewer({
      employee,
      request,
      statusType: getDefaultAttendanceTypes().find(
        (type) => type.id === 'sick'
      ),
      viewer: teammate,
    })

    assert.equal(view.employeeName, 'Hidden by policy')
    assert.equal(view.auditVisible, false)
    assert.equal(view.visibility, 'hidden')
  })
})
