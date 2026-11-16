import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  leadingBlankDays,
  orderedWeekdays,
  weekStartDay,
  weekStartOffset,
} from './week'

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

describe('week start', () => {
  it('maps each setting to a getDay index', () => {
    assert.equal(weekStartDay('monday'), 1)
    assert.equal(weekStartDay('sunday'), 0)
  })

  describe('weekStartOffset', () => {
    it('reaches Monday from any day of a Monday-first week', () => {
      // 2026-05-04 is a Monday.
      assert.equal(weekStartOffset(new Date(2026, 4, 4), 'monday'), 0)
      assert.equal(weekStartOffset(new Date(2026, 4, 7), 'monday'), -3)
      // Sunday belongs to the week that began six days earlier, which is the
      // case the old inline arithmetic special-cased by hand.
      assert.equal(weekStartOffset(new Date(2026, 4, 10), 'monday'), -6)
    })

    it('reaches Sunday from any day of a Sunday-first week', () => {
      assert.equal(weekStartOffset(new Date(2026, 4, 10), 'sunday'), 0)
      assert.equal(weekStartOffset(new Date(2026, 4, 4), 'sunday'), -1)
      assert.equal(weekStartOffset(new Date(2026, 4, 9), 'sunday'), -6)
    })

    it('never points forward', () => {
      for (let day = 1; day <= 31; day += 1) {
        const date = new Date(2026, 4, day)

        assert.ok(weekStartOffset(date, 'monday') <= 0)
        assert.ok(weekStartOffset(date, 'sunday') <= 0)
      }
    })
  })

  describe('orderedWeekdays', () => {
    it('rotates the Sunday-indexed names to the configured start', () => {
      assert.deepEqual(orderedWeekdays(NAMES, 'sunday'), [...NAMES])
      assert.deepEqual(orderedWeekdays(NAMES, 'monday'), [
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat',
        'Sun',
      ])
    })
  })

  describe('leadingBlankDays', () => {
    it('pads a month grid to its first weekday', () => {
      // 1 May 2026 is a Friday.
      const may = new Date(2026, 4, 1)

      assert.equal(leadingBlankDays(may, 'monday'), 4)
      assert.equal(leadingBlankDays(may, 'sunday'), 5)
    })

    it('pads nothing when the month opens on the first weekday', () => {
      // 1 June 2026 is a Monday.
      assert.equal(leadingBlankDays(new Date(2026, 5, 1), 'monday'), 0)
    })
  })
})
