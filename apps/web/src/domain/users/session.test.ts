import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLocalDevSession, getSessionSourceLabel } from './session'

describe('user session model', () => {
  it('creates a local simulated session from the signed-in employee', () => {
    const session = createLocalDevSession({
      displayName: 'Hannah Fischer',
      employeeId: 'usr-hannah-fischer',
      role: 'employee',
      team: 'B2X Platform',
    })

    assert.equal(session.id, 'local-session-usr-hannah-fischer')
    assert.equal(session.employeeId, 'usr-hannah-fischer')
    assert.equal(session.displayName, 'Hannah Fischer')
    assert.equal(session.role, 'employee')
    assert.equal(session.team, 'B2X Platform')
    assert.equal(session.source, 'local-dev')
    assert.match(session.issuedAt, /^\d{4}-\d{2}-\d{2}T/)
  })

  it('labels local and backend session sources clearly', () => {
    assert.equal(getSessionSourceLabel('local-dev'), 'Local simulated session')
    assert.equal(
      getSessionSourceLabel('backend'),
      'Backend authenticated session'
    )
  })
})
