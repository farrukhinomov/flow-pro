import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatTimeZoneLabel,
  listSupportedTimeZones,
  listTimeZoneOptions,
  resolveBrowserTimeZone,
} from './timezones'

describe('time zones', () => {
  it('offers far more than the five zones that used to be hardcoded', () => {
    const zones = listSupportedTimeZones()

    assert.ok(
      zones.length > 100,
      `expected a full IANA list, got ${zones.length}`
    )
    assert.ok(zones.includes('Europe/Berlin'))
    assert.ok(zones.includes('America/New_York'))
    assert.ok(zones.includes('Asia/Tokyo'))
  })

  it('labels a zone with its current UTC offset', () => {
    const label = formatTimeZoneLabel('Europe/Berlin', new Date('2026-07-01'))

    assert.match(label, /^Europe\/Berlin \(GMT[+-]\d/)
  })

  it('falls back to the raw id for an unknown zone', () => {
    assert.equal(formatTimeZoneLabel('Mars/Olympus'), 'Mars/Olympus')
  })

  it('builds picker options with a value and a label', () => {
    const options = listTimeZoneOptions()
    const berlin = options.find((option) => option.value === 'Europe/Berlin')

    assert.ok(berlin)
    assert.match(berlin.label, /Europe\/Berlin/)
  })

  it('resolves a usable browser zone', () => {
    assert.ok(resolveBrowserTimeZone().length > 0)
  })
})
