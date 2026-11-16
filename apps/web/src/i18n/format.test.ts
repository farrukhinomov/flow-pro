import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatDateRange,
  formatDateTime,
  formatMediumDate,
  formatRelativeTime,
  formatShortDate,
  formatTime,
  localeTag,
} from './format'

const may4 = new Date('2026-05-04T09:30:00Z')

describe('locale formatting', () => {
  it('resolves English to en-GB so dates stay day-first', () => {
    // en-US would render 2026-05-04 as 05/04/2026 and silently change meaning.
    assert.equal(localeTag('en'), 'en-GB')
    assert.equal(localeTag('de'), 'de-DE')
  })

  describe('formatShortDate', () => {
    it('uses slashes for English and dots for German', () => {
      assert.equal(formatShortDate(may4, 'en'), '04/05/2026')
      assert.equal(formatShortDate(may4, 'de'), '04.05.2026')
    })
  })

  describe('formatMediumDate', () => {
    it('localizes the month name', () => {
      assert.match(formatMediumDate(may4, 'en'), /May/)
      assert.match(formatMediumDate(may4, 'de'), /Mai/)
    })
  })

  describe('formatTime', () => {
    it('renders 24-hour time in both locales', () => {
      assert.match(formatTime(may4, 'en'), /^\d{2}:\d{2}$/)
      assert.match(formatTime(may4, 'de'), /^\d{2}:\d{2}$/)
    })
  })

  describe('formatDateTime', () => {
    it('includes both the date and the time', () => {
      assert.match(formatDateTime(may4, 'de'), /04\.05\.2026/)
      assert.match(formatDateTime(may4, 'de'), /\d{2}:\d{2}/)
    })
  })

  describe('formatDateRange', () => {
    it('collapses a single-day range to one date', () => {
      assert.equal(
        formatDateRange('2026-05-04', '2026-05-04', 'de'),
        '04.05.2026'
      )
    })

    it('renders both ends of a multi-day range', () => {
      assert.equal(
        formatDateRange('2026-05-04', '2026-05-06', 'de'),
        '04.05.2026 - 06.05.2026'
      )
    })
  })

  describe('formatRelativeTime', () => {
    const now = new Date('2026-05-04T12:00:00Z')

    it('localizes past distances', () => {
      const twoHoursAgo = new Date('2026-05-04T10:00:00Z')

      assert.match(formatRelativeTime(twoHoursAgo, 'en', now), /2 hours ago/)
      assert.match(formatRelativeTime(twoHoursAgo, 'de', now), /vor 2 Stunden/)
    })

    it('localizes future distances', () => {
      const inThreeDays = new Date('2026-05-07T12:00:00Z')

      assert.match(formatRelativeTime(inThreeDays, 'en', now), /in 3 days/)
      assert.match(formatRelativeTime(inThreeDays, 'de', now), /in 3 Tagen/)
    })

    it('falls back to seconds for very recent timestamps', () => {
      const justNow = new Date('2026-05-04T11:59:50Z')

      assert.match(formatRelativeTime(justNow, 'en', now), /second/)
    })
  })

  describe('invalid input', () => {
    it('renders an empty string rather than "Invalid Date"', () => {
      assert.equal(formatShortDate('not-a-date', 'en'), '')
      assert.equal(formatRelativeTime('not-a-date', 'en'), '')
    })
  })
})
