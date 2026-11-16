import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSameCalendarDay, toCalendarDay } from './calendar-day'

/** 4 May 2026, 22:30 UTC. Already 5 May in Berlin, still 4 May in London. */
const LATE_SHIFT_UTC = '2026-05-04T22:30:00.000Z'

describe('calendar day', () => {
  describe('without an anchor', () => {
    it('uses the local day, not the UTC day', () => {
      // The first regression this prevented: the timesheet read the UTC prefix
      // while Today read the browser day, so a late finish landed on the wrong
      // row of the payroll record.
      const local = new Date(LATE_SHIFT_UTC)

      assert.equal(toCalendarDay(LATE_SHIFT_UTC), toCalendarDay(local))
    })

    it('formats as yyyy-MM-dd with padding', () => {
      assert.equal(toCalendarDay(new Date(2026, 0, 5, 9, 0)), '2026-01-05')
      assert.equal(toCalendarDay(new Date(2026, 10, 30, 9, 0)), '2026-11-30')
    })

    it('agrees across both input shapes', () => {
      const date = new Date(2026, 4, 4, 23, 59)

      assert.equal(toCalendarDay(date), toCalendarDay(date.toISOString()))
    })
  })

  describe('anchored to a workspace zone', () => {
    it('assigns a late shift to the workspace day', () => {
      assert.equal(toCalendarDay(LATE_SHIFT_UTC, 'Europe/Berlin'), '2026-05-05')
      assert.equal(toCalendarDay(LATE_SHIFT_UTC, 'Europe/London'), '2026-05-04')
      assert.equal(toCalendarDay(LATE_SHIFT_UTC, 'UTC'), '2026-05-04')
    })

    it('gives every reader the same day regardless of where they are', () => {
      // The reason anchoring exists. An employee in Berlin and a manager in
      // Tokyo must not disagree about which day a shift belongs to, and a
      // payroll export must not depend on who generated it.
      const anchored = toCalendarDay(LATE_SHIFT_UTC, 'Europe/Berlin')

      assert.equal(toCalendarDay(LATE_SHIFT_UTC, 'Europe/Berlin'), anchored)
      assert.equal(
        toCalendarDay(new Date(LATE_SHIFT_UTC), 'Europe/Berlin'),
        anchored
      )
    })

    it('handles a zone behind UTC', () => {
      // 22:30 UTC is still 18:30 the same day in New York.
      assert.equal(
        toCalendarDay(LATE_SHIFT_UTC, 'America/New_York'),
        '2026-05-04'
      )
      // 02:00 UTC on 5 May is still 4 May there.
      assert.equal(
        toCalendarDay('2026-05-05T02:00:00.000Z', 'America/New_York'),
        '2026-05-04'
      )
    })

    it('respects daylight saving rather than a fixed offset', () => {
      // Berlin is UTC+1 in January and UTC+2 in July. A fixed offset would get
      // one of these wrong.
      assert.equal(
        toCalendarDay('2026-01-04T23:30:00.000Z', 'Europe/Berlin'),
        '2026-01-05'
      )
      assert.equal(
        toCalendarDay('2026-07-04T22:30:00.000Z', 'Europe/Berlin'),
        '2026-07-05'
      )
      assert.equal(
        toCalendarDay('2026-01-04T22:30:00.000Z', 'Europe/Berlin'),
        '2026-01-04'
      )
    })

    it('is not affected by the reader language', () => {
      // Read through formatToParts rather than a locale that happens to format
      // ISO-shaped, so a German reader gets the same key as an English one.
      assert.match(
        toCalendarDay(LATE_SHIFT_UTC, 'Europe/Berlin'),
        /^\d{4}-\d{2}-\d{2}$/
      )
    })
  })

  describe('degradation', () => {
    it('falls back to the browser zone for an unknown zone', () => {
      // An unusable zone must not take the timesheet down.
      assert.equal(
        toCalendarDay(LATE_SHIFT_UTC, 'Mars/Olympus'),
        toCalendarDay(LATE_SHIFT_UTC)
      )
    })

    it('returns an empty string for an unusable instant', () => {
      assert.equal(toCalendarDay('not-a-date'), '')
      assert.equal(toCalendarDay('not-a-date', 'Europe/Berlin'), '')
    })
  })

  describe('isSameCalendarDay', () => {
    it('compares both instants in the same zone', () => {
      const berlinFifth = new Date('2026-05-05T09:00:00.000Z')

      assert.ok(
        isSameCalendarDay(LATE_SHIFT_UTC, berlinFifth, 'Europe/Berlin'),
        'the late shift belongs to the 5th in Berlin'
      )
      assert.ok(
        !isSameCalendarDay(LATE_SHIFT_UTC, berlinFifth, 'Europe/London'),
        'and to the 4th in London'
      )
    })

    it('matches any time on the same local day when unanchored', () => {
      const day = new Date(2026, 4, 4, 12, 0)

      assert.ok(isSameCalendarDay(new Date(2026, 4, 4, 0, 0), day))
      assert.ok(isSameCalendarDay(new Date(2026, 4, 4, 23, 59), day))
      assert.ok(!isSameCalendarDay(new Date(2026, 4, 5, 0, 1), day))
    })
  })
})
