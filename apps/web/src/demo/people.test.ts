import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SEED_WORKER_PASSWORD, seedUserCredentials, seedUsers } from './people'

describe('seed users', () => {
  it('starts with Marta as the single superadmin account', () => {
    const marta = seedUsers.find((user) => user.id === 'usr-marta-lindgren')

    assert.equal(seedUsers.length, 101)
    assert.equal(marta?.firstName, 'Marta')
    assert.equal(marta?.lastName, 'Lindgren')
    assert.equal(marta?.email, 'founder@flowpro.local')
    assert.equal(marta?.role, 'superadmin')
    assert.equal(marta?.team, 'Management')
    assert.equal(seedUserCredentials.length, seedUsers.length)
    assert.deepEqual(seedUserCredentials[0], {
      email: 'founder@flowpro.local',
      password: 'superadmin',
      userId: 'usr-marta-lindgren',
    })
    assert.equal(seedUserCredentials[1]?.password, SEED_WORKER_PASSWORD)
  })

  it('keeps the 100 worker accounts unique and spread across real teams', () => {
    const workers = seedUsers.filter((user) => user.id !== 'usr-marta-lindgren')
    const emails = new Set(seedUsers.map((user) => user.email))
    const ids = new Set(seedUsers.map((user) => user.id))
    const teams = new Set(seedUsers.map((user) => user.team))

    assert.equal(workers.length, 100)
    assert.equal(emails.size, seedUsers.length)
    assert.equal(ids.size, seedUsers.length)
    assert.equal(teams.has('B2X Platform'), true)
    assert.equal(teams.has('B2L Product'), true)
    assert.equal(teams.has('Sales DACH'), true)
    assert.equal(teams.has('Consultants'), true)
    assert.equal(teams.has('Customer Support'), true)
    assert.equal(teams.has('People & Culture'), true)
  })
})
