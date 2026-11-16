import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GERMAN_STATE_CODES,
  getEasterSunday,
  getGermanPublicHolidays,
} from './german-holidays'

function datesFor(year: number, state?: string) {
  return new Map(
    getGermanPublicHolidays(year, state).map((holiday) => [
      holiday.name,
      holiday.date,
    ])
  )
}

describe('getEasterSunday', () => {
  it('matches published Easter dates across century boundaries', () => {
    // Independently known values; the algorithm is worth pinning because every movable
    // German holiday is derived from it.
    const expected: Record<number, string> = {
      2024: '2024-03-31',
      2025: '2025-04-20',
      2026: '2026-04-05',
      2027: '2027-03-28',
      2030: '2030-04-21',
      2038: '2038-04-25',
    }

    for (const [year, date] of Object.entries(expected)) {
      assert.equal(
        getEasterSunday(Number(year)).toISOString().slice(0, 10),
        date,
        `Easter ${year}`
      )
    }
  })
})

describe('getGermanPublicHolidays', () => {
  it('derives the movable feasts that the seeded 2026 calendar listed by hand', () => {
    const holidays = datesFor(2026)

    assert.equal(holidays.get('Karfreitag'), '2026-04-03')
    assert.equal(holidays.get('Ostermontag'), '2026-04-06')
    assert.equal(holidays.get('Christi Himmelfahrt'), '2026-05-14')
    assert.equal(holidays.get('Pfingstmontag'), '2026-05-25')
  })

  it('returns the nine nationwide holidays when no state is given', () => {
    const holidays = getGermanPublicHolidays(2027)

    assert.equal(holidays.length, 9)
    assert.ok(holidays.every((holiday) => holiday.region === 'DE'))
  })

  it('produces a calendar for any year, not just the seeded one', () => {
    // The regression this guards: the previous hardcoded list was filtered by year prefix,
    // so every year other than 2026 resolved to an empty calendar.
    for (const year of [2025, 2027, 2028, 2030]) {
      assert.ok(
        getGermanPublicHolidays(year).length >= 9,
        `expected holidays for ${year}`
      )
      assert.ok(
        getGermanPublicHolidays(year).every((holiday) =>
          holiday.date.startsWith(`${year}-`)
        ),
        `expected only ${year} dates`
      )
    }
  })

  it('gives Bayern more holidays than Berlin, as the state acts do', () => {
    const bavaria = getGermanPublicHolidays(2026, 'BY')
    const berlin = getGermanPublicHolidays(2026, 'BE')

    // Twelve, not the thirteen usually quoted for Bayern: that figure counts Mariä
    // Himmelfahrt, which there applies only in municipalities with a Catholic majority.
    // Claiming it state-wide would overstate the holiday entitlement of everyone in the
    // remaining municipalities, so it stays scoped to Saarland.
    assert.equal(bavaria.length, 12)
    assert.equal(berlin.length, 10)
    assert.ok(!bavaria.some((holiday) => holiday.name === 'Mariä Himmelfahrt'))
    assert.ok(bavaria.some((holiday) => holiday.name === 'Fronleichnam'))
    assert.ok(!berlin.some((holiday) => holiday.name === 'Fronleichnam'))
    assert.ok(
      berlin.some((holiday) => holiday.name === 'Internationaler Frauentag')
    )
  })

  it('places Buß- und Bettag on the Wednesday before 23 November, in Sachsen only', () => {
    const saxony = datesFor(2026, 'SN')
    const thuringia = datesFor(2026, 'TH')

    // 23 November 2026 is a Monday, so the preceding Wednesday is the 18th.
    assert.equal(saxony.get('Buß- und Bettag'), '2026-11-18')
    assert.equal(thuringia.get('Buß- und Bettag'), undefined)

    for (const year of [2025, 2027, 2028]) {
      const date = datesFor(year, 'SN').get('Buß- und Bettag')
      assert.ok(date, `expected Buß- und Bettag in ${year}`)
      assert.equal(
        new Date(`${date}T00:00:00Z`).getUTCDay(),
        3,
        `${date} should be a Wednesday`
      )
    }
  })

  it('scopes Reformationstag to the states that observe it', () => {
    assert.ok(
      getGermanPublicHolidays(2026, 'HH').some(
        (holiday) => holiday.name === 'Reformationstag'
      )
    )
    assert.ok(
      !getGermanPublicHolidays(2026, 'BW').some(
        (holiday) => holiday.name === 'Reformationstag'
      )
    )
  })

  it('falls back to the nationwide set for an unknown state code', () => {
    // Configuration may hold a legacy or non-German value; the safe answer is the subset
    // every state observes rather than an empty calendar.
    assert.equal(getGermanPublicHolidays(2026, 'XX').length, 9)
    assert.equal(getGermanPublicHolidays(2026, 'DE').length, 9)
  })

  it('never produces duplicate dates within a state', () => {
    for (const state of GERMAN_STATE_CODES) {
      const dates = getGermanPublicHolidays(2026, state).map(
        (holiday) => holiday.date
      )
      assert.equal(
        new Set(dates).size,
        dates.length,
        `${state} has duplicate holiday dates`
      )
    }
  })
})
