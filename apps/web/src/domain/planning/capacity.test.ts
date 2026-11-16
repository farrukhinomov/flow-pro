import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateTeamCapacity,
  findCoverageCandidates,
  parseWorkPattern,
  simulateApprovalImpact,
} from './capacity'
import type { PlanningPerson } from './types'

function person(
  id: string,
  workPattern = 'Full-time · Office first',
  entries: PlanningPerson['entries'] = []
): PlanningPerson {
  return {
    displayName: id,
    entries,
    id,
    name: id,
    role: workPattern,
    team: 'Operations',
    user: {
      createdAt: new Date('2026-01-01'),
      email: `${id}@flowpro.dev`,
      firstName: id,
      id,
      lastName: 'User',
      manager: 'Anna Queen',
      phoneNumber: '',
      role: 'employee',
      status: 'active',
      team: 'Operations',
      updatedAt: new Date('2026-01-01'),
      username: id,
      visibilityScope: 'Availability only',
      workPattern,
    },
  }
}

describe('planning capacity', () => {
  it('parses part-time work patterns into weekday capacity', () => {
    const profile = parseWorkPattern('Part-time · Mon-Wed')

    assert.equal(profile.capacity, 0.6)
    assert.deepEqual(profile.workdays, [1, 2, 3])
  })

  it('flags minimum staffing conflicts', () => {
    const days = calculateTeamCapacity({
      days: 1,
      people: [
        person('one', 'Full-time · Office first', [
          {
            category: 'leave',
            code: 'VAC',
            date: '2026-05-04',
            visibility: 'operational',
          },
        ]),
        person('two'),
      ],
      rules: [{ minimumStaff: 2, team: 'Operations' }],
      startDate: new Date('2026-05-04T12:00:00'),
    })

    assert.equal(days[0].status, 'conflict')
    assert.equal(days[0].available, 1)
  })

  it('does not flag days nobody in the team is scheduled to work', () => {
    // 2026-05-09 and 2026-05-10 are a Saturday and a Sunday.
    const days = calculateTeamCapacity({
      days: 2,
      people: [person('one'), person('two')],
      rules: [{ minimumOnSite: 1, minimumStaff: 2, team: 'Operations' }],
      startDate: new Date('2026-05-09T12:00:00'),
    })

    assert.deepEqual(
      days.map((day) => [day.scheduled, day.status, day.warnings.length]),
      [
        [0, 'healthy', 0],
        [0, 'healthy', 0],
      ]
    )
  })

  it('still flags a working day everyone scheduled is away', () => {
    const days = calculateTeamCapacity({
      days: 1,
      people: [
        person('one', 'Full-time · Office first', [
          {
            category: 'leave',
            code: 'VAC',
            date: '2026-05-04',
            visibility: 'operational',
          },
        ]),
      ],
      rules: [{ minimumStaff: 1, team: 'Operations' }],
      startDate: new Date('2026-05-04T12:00:00'),
    })

    assert.equal(days[0].status, 'conflict')
    assert.equal(days[0].available, 0)
  })

  it('ranks same-team available cover first', () => {
    const candidates = findCoverageCandidates({
      date: '2026-05-04',
      people: [person('same'), { ...person('other'), team: 'Support' }],
      team: 'Operations',
    })

    assert.equal(candidates[0].fit, 'strong')
    assert.equal(candidates[0].team, 'Operations')
  })

  it('simulates pending absence approval impact', () => {
    const impact = simulateApprovalImpact({
      people: [person('one'), person('two')],
      request: {
        employeeId: 'one',
        employeeName: 'one',
        fromDate: '2026-05-04',
        id: 'request-1',
        kind: 'absence',
        status: 'submitted',
        statusCode: 'VAC',
        subtype: 'Vacation',
        submittedAt: '2026-05-01T08:00:00.000Z',
        syncState: 'synced',
        toDate: '2026-05-04',
        updatedAt: '2026-05-01T08:00:00.000Z',
      },
      rules: [{ minimumStaff: 2, team: 'Operations' }],
    })

    assert.equal(impact?.after[0].status, 'conflict')
    assert.equal(impact?.warnings.length, 1)
  })
})
