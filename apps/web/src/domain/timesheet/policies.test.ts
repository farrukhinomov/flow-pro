import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultWorkContract, getTargetHoursForDate } from './policies'

describe('timesheet policies', () => {
  it('uses work contract hours for weekday targets', () => {
    assert.equal(getTargetHoursForDate(defaultWorkContract, '2026-05-04'), 8)
  })

  it('does not assign target hours to weekends', () => {
    assert.equal(
      getTargetHoursForDate(defaultWorkContract, '2026-05-03'),
      undefined
    )
  })
})
