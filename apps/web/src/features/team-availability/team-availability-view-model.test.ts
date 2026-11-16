import type { TeamAvailabilityMember } from '@/domain/planning/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EMPTY_VALUE } from '@/lib/utils'
import {
  buildTeamCapacityCsv,
  filterTeamAvailabilityMembers,
  formatOptionalDate,
  getInitials,
  getReturningSoonMembers,
  getUnavailableMembers,
  getVisibleNote,
} from './team-availability-view-model'

const members: TeamAvailabilityMember[] = [
  {
    id: 'employee-1',
    name: 'Hannah Fischer',
    policy: 'operational',
    role: 'Full-time · Hybrid',
    status: 'remote',
    team: 'Support',
    note: 'Home office',
    until: '2026-05-27',
  },
  {
    id: 'employee-2',
    name: 'Lukas Schneider',
    policy: 'confidential',
    role: 'Full-time · Office first',
    status: 'absent',
    team: 'Sales',
    until: '2026-06-03',
  },
]

describe('team availability view model', () => {
  it('filters people by searchable identity fields', () => {
    assert.deepEqual(
      filterTeamAvailabilityMembers(members, 'support').map(
        (member) => member.name
      ),
      ['Hannah Fischer']
    )
  })

  it('masks confidential details and formats fallback dates', () => {
    assert.equal(getVisibleNote(members[0]), 'Home office')
    assert.equal(getVisibleNote(members[1]), 'Details hidden by policy')
    assert.equal(formatOptionalDate(undefined, 'en'), EMPTY_VALUE)
    assert.equal(formatOptionalDate('2026-05-27', 'en'), '27 May')
    assert.equal(formatOptionalDate('2026-05-27', 'de'), '27. Mai')
  })

  it('returns initials and unavailable groups for compact cards', () => {
    assert.equal(getInitials('Hannah Fischer'), 'HF')
    assert.deepEqual(
      getUnavailableMembers(members).map((member) => member.name),
      ['Lukas Schneider']
    )
  })

  it('finds people returning inside the planning window', () => {
    assert.deepEqual(
      getReturningSoonMembers({
        members,
        today: new Date('2026-05-24T12:00:00'),
      }).map((member) => member.name),
      ['Hannah Fischer']
    )
  })

  it('builds escaped capacity CSV rows', () => {
    const csv = buildTeamCapacityCsv([
      {
        available: 1,
        capacity: 1,
        date: '2026-05-24',
        minimumOnSite: 1,
        minimumStaff: 2,
        remote: 0,
        scheduled: 2,
        status: 'conflict',
        team: 'Support',
        unavailable: 1,
        warnings: ['Support is below minimum staffing: 1/2.'],
      },
    ])

    // Quoting is RFC 4180 minimal (shared with every other FlowPro export), so
    // only cells containing a separator, quote, or newline are wrapped.
    assert.match(csv, /Date,Team,Scheduled/)
    assert.match(csv, /Support,2,1,0,1,1\.0/)
    assert.match(csv, /Support is below minimum staffing: 1\/2\./)
  })

  it('neutralizes formula injection in capacity CSV cells', () => {
    const csv = buildTeamCapacityCsv([
      {
        available: 1,
        capacity: 1,
        date: '2026-05-24',
        minimumOnSite: 1,
        minimumStaff: 2,
        remote: 0,
        scheduled: 2,
        status: 'conflict',
        team: '=cmd|calc',
        unavailable: 1,
        warnings: [],
      },
    ])

    assert.ok(
      !/(^|,)=cmd/.test(csv),
      'no raw formula cell may reach the spreadsheet'
    )
  })
})
