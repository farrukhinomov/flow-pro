import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences,
} from './preferences'

describe('user preferences', () => {
  it('returns the defaults for a missing value', () => {
    assert.deepEqual(normalizeUserPreferences(null), DEFAULT_USER_PREFERENCES)
    assert.deepEqual(
      normalizeUserPreferences(undefined),
      DEFAULT_USER_PREFERENCES
    )
  })

  it('keeps valid values', () => {
    const normalized = normalizeUserPreferences({
      defaultWorkLocation: 'home-office',
      densityCompact: true,
      fullWidthPages: false,
      locale: 'de',
      showPolicyHints: false,
      showSyncStatus: false,
      timeZoneId: 'Europe/Vienna',
      weekStart: 'sunday',
    })

    assert.equal(normalized.defaultWorkLocation, 'home-office')
    assert.equal(normalized.locale, 'de')
    assert.equal(normalized.timeZoneId, 'Europe/Vienna')
    assert.equal(normalized.weekStart, 'sunday')
    assert.equal(normalized.densityCompact, true)
    assert.equal(normalized.fullWidthPages, false)
  })

  it('replaces unknown enum values with the defaults', () => {
    // Guards against a cache written by an older build putting an unusable
    // value into a select.
    const normalized = normalizeUserPreferences({
      defaultWorkLocation: 'the-beach' as never,
      weekStart: 'caturday' as never,
    })

    assert.equal(normalized.weekStart, 'monday')
    assert.equal(normalized.defaultWorkLocation, 'office')
  })

  it('falls back for blank strings', () => {
    const normalized = normalizeUserPreferences({
      locale: '   ',
      timeZoneId: '',
    })

    assert.equal(normalized.locale, 'en')
    assert.equal(normalized.timeZoneId, 'Europe/Berlin')
  })

  it('preserves booleans that are explicitly false', () => {
    // `??` rather than `||`, so turning every display option off survives.
    const normalized = normalizeUserPreferences({
      fullWidthPages: false,
      showPolicyHints: false,
      showSyncStatus: false,
    })

    assert.equal(normalized.fullWidthPages, false)
    assert.equal(normalized.showPolicyHints, false)
    assert.equal(normalized.showSyncStatus, false)
  })
})
