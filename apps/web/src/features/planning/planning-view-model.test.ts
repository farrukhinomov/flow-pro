import type { PlanningPerson } from '@/domain/planning/types'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPlanningCsv,
  buildPlanningDayMeta,
  getAbsenceStyle,
  getDayKind,
  getPlanningStats,
} from './planning-view-model'

function user(overrides: Partial<EmployeeUser> = {}): EmployeeUser {
  return {
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    email: 'hannah.fischer@example.com',
    firstName: 'Hannah',
    id: 'employee-1',
    lastName: 'Fischer',
    manager: 'Tobias Weber',
    phoneNumber: '+49 151 0000000',
    role: 'employee',
    status: 'active',
    team: 'Support',
    updatedAt: new Date('2026-01-01T08:00:00.000Z'),
    username: 'hannah.fischer',
    visibilityScope: 'team',
    workPattern: 'Full-time · Hybrid',
    ...overrides,
  }
}

const person: PlanningPerson = {
  displayName: 'Hannah Fischer',
  entries: [
    {
      category: 'remote',
      code: 'HO',
      date: '2026-05-04',
      label: 'Home office',
      visibility: 'operational',
    },
    {
      category: 'leave',
      code: 'VAC',
      date: '2026-05-05',
      isPending: true,
      label: 'Vacation',
      visibility: 'operational',
    },
    {
      category: 'sickness',
      code: 'SICK',
      date: '2026-05-06',
      isAnon: true,
      visibility: 'state-only',
    },
  ],
  id: 'employee-1',
  name: 'Fischer, Hannah',
  role: 'Full-time · Hybrid',
  team: 'Support',
  user: user(),
}

describe('planning view model', () => {
  it('classifies workdays, weekends, and public holidays', () => {
    assert.equal(getDayKind(new Date('2026-05-01T12:00:00')), 'holiday')
    assert.equal(getDayKind(new Date('2026-05-02T12:00:00')), 'weekend')
    assert.equal(getDayKind(new Date('2026-05-04T12:00:00')), 'weekday')
  })

  it('summarizes planning stats for the selected month', () => {
    assert.deepEqual(
      getPlanningStats({
        conflictCount: 2,
        month: new Date('2026-05-01T12:00:00'),
        people: [person],
      }),
      {
        confidential: 1,
        conflicts: 2,
        leaveDays: 1,
        pending: 1,
        remoteDays: 1,
      }
    )
  })

  it('builds payroll-style planning csv rows', () => {
    const csv = buildPlanningCsv({
      month: new Date('2026-05-01T12:00:00'),
      people: [person],
    })

    // Quoting is RFC 4180 minimal (shared with every other FlowPro export), so
    // only cells containing a separator, quote, or newline are wrapped.
    assert.match(csv, /Date,Employee,Team/)
    assert.match(csv, /2026-05-04,"Fischer, Hannah",Support/)
    assert.match(csv, /HO,Home office,remote/)
    // Named as the state holiday acts do. The seeded calendar this replaced used the
    // colloquial "Maifeiertag"; both are current German usage for 1 May.
    assert.match(csv, /2026-05-01.*Tag der Arbeit/)
  })

  it('neutralizes formula injection in planning CSV cells', () => {
    const csv = buildPlanningCsv({
      month: new Date('2026-05-01T12:00:00'),
      people: [{ ...person, name: '=HYPERLINK("http://evil","x")' }],
    })

    assert.ok(
      !/(^|,)=HYPERLINK/.test(csv),
      'no raw formula cell may reach the spreadsheet'
    )
  })

  it('returns fallback styles for unknown absence codes', () => {
    assert.equal(
      getAbsenceStyle({
        code: 'X',
        date: '2026-05-04',
        label: 'Custom',
        visibility: 'full',
      }).label,
      'Custom'
    )
  })
})

describe('planning day metadata', () => {
  it('derives iso, kind, and holiday name once per day', () => {
    const meta = buildPlanningDayMeta([
      new Date('2026-05-01T12:00:00'),
      new Date('2026-05-02T12:00:00'),
      new Date('2026-05-04T12:00:00'),
    ])

    assert.deepEqual(
      meta.map((day) => day.iso),
      ['2026-05-01', '2026-05-02', '2026-05-04']
    )
    assert.deepEqual(
      meta.map((day) => day.kind),
      ['holiday', 'weekend', 'weekday']
    )
    assert.equal(meta[0].holidayName, 'Tag der Arbeit')
    assert.equal(meta[2].holidayName, undefined)
  })

  it('agrees with getDayKind, which it replaced in the grids', () => {
    const days = [
      new Date('2026-05-01T12:00:00'),
      new Date('2026-05-02T12:00:00'),
      new Date('2026-05-03T12:00:00'),
      new Date('2026-05-04T12:00:00'),
      new Date('2026-05-25T12:00:00'),
    ]

    for (const day of buildPlanningDayMeta(days)) {
      assert.equal(day.kind, getDayKind(day.date))
    }
  })
})
