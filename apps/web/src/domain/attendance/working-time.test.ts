import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ARBZG_MAX_DAILY_HOURS,
  ARBZG_MIN_REST_HOURS,
  evaluateWorkingTime,
  getRequiredBreakMinutes,
  STATUTORY_BREAK_POLICY,
} from './working-time'

describe('getRequiredBreakMinutes', () => {
  it('applies the ArbZG § 4 thresholds', () => {
    assert.equal(getRequiredBreakMinutes(4), 0)
    assert.equal(getRequiredBreakMinutes(6.5), 30)
    assert.equal(getRequiredBreakMinutes(9.5), 45)
  })

  it('treats the thresholds as exclusive, as "mehr als" requires', () => {
    // Exactly six hours needs no break; a minute more does.
    assert.equal(getRequiredBreakMinutes(6), 0)
    assert.equal(getRequiredBreakMinutes(6.017), 30)
    assert.equal(getRequiredBreakMinutes(9), 30)
    assert.equal(getRequiredBreakMinutes(9.017), 45)
  })

  it('honours a configured policy that is stricter than the statute', () => {
    const houseRules = [
      { afterHours: 4, minimumMinutes: 15 },
      { afterHours: 6, minimumMinutes: 45 },
    ]

    assert.equal(getRequiredBreakMinutes(5, houseRules), 15)
    assert.equal(getRequiredBreakMinutes(7, houseRules), 45)
  })

  it('takes the longest applicable break when thresholds overlap', () => {
    const overlapping = [
      { afterHours: 6, minimumMinutes: 45 },
      { afterHours: 7, minimumMinutes: 30 },
    ]

    assert.equal(getRequiredBreakMinutes(8, overlapping), 45)
  })

  it('defaults to the statutory policy', () => {
    assert.equal(
      getRequiredBreakMinutes(7),
      getRequiredBreakMinutes(7, STATUTORY_BREAK_POLICY)
    )
  })
})

describe('evaluateWorkingTime', () => {
  it('reports a shift that is missing its statutory break', () => {
    const violations = evaluateWorkingTime({
      shifts: [{ date: '2026-05-04', workedHours: 8, breakHours: 0.25 }],
    })

    assert.deepEqual(violations, [
      {
        date: '2026-05-04',
        rule: 'break',
        actualHours: 0.25,
        requiredHours: 0.5,
      },
    ])
  })

  it('accepts a compliant shift', () => {
    const violations = evaluateWorkingTime({
      shifts: [{ date: '2026-05-04', workedHours: 8, breakHours: 0.5 }],
    })

    assert.deepEqual(violations, [])
  })

  it('reports work beyond the ArbZG § 3 daily maximum', () => {
    const violations = evaluateWorkingTime({
      shifts: [{ date: '2026-05-04', workedHours: 10.5, breakHours: 0.75 }],
    })

    assert.deepEqual(violations, [
      {
        date: '2026-05-04',
        rule: 'max-daily-hours',
        actualHours: 10.5,
        requiredHours: ARBZG_MAX_DAILY_HOURS,
      },
    ])
  })

  it('allows exactly ten hours, which § 3 still permits', () => {
    const violations = evaluateWorkingTime({
      shifts: [{ date: '2026-05-04', workedHours: 10, breakHours: 0.75 }],
    })

    assert.deepEqual(violations, [])
  })

  it('reports less than eleven hours of rest between consecutive shifts', () => {
    const violations = evaluateWorkingTime({
      shifts: [
        {
          date: '2026-05-04',
          workedHours: 8,
          breakHours: 0.5,
          firstInAt: '2026-05-04T08:00:00Z',
          lastOutAt: '2026-05-04T22:00:00Z',
        },
        {
          date: '2026-05-05',
          workedHours: 8,
          breakHours: 0.5,
          firstInAt: '2026-05-05T06:00:00Z',
          lastOutAt: '2026-05-05T15:00:00Z',
        },
      ],
    })

    assert.deepEqual(violations, [
      {
        date: '2026-05-05',
        rule: 'rest-period',
        actualHours: 8,
        requiredHours: ARBZG_MIN_REST_HOURS,
      },
    ])
  })

  it('accepts exactly eleven hours of rest', () => {
    const violations = evaluateWorkingTime({
      shifts: [
        {
          date: '2026-05-04',
          workedHours: 8,
          breakHours: 0.5,
          lastOutAt: '2026-05-04T20:00:00Z',
        },
        {
          date: '2026-05-05',
          workedHours: 8,
          breakHours: 0.5,
          firstInAt: '2026-05-05T07:00:00Z',
        },
      ],
    })

    assert.deepEqual(violations, [])
  })

  it('cannot judge rest for a day with no recorded clock pair', () => {
    // A missing timestamp must not be reported as a rest violation, otherwise every day
    // following an absence would be flagged.
    const violations = evaluateWorkingTime({
      shifts: [
        { date: '2026-05-04', workedHours: 0, breakHours: 0 },
        {
          date: '2026-05-05',
          workedHours: 8,
          breakHours: 0.5,
          firstInAt: '2026-05-05T06:00:00Z',
        },
      ],
    })

    assert.deepEqual(violations, [])
  })

  it('orders shifts before comparing them, so input order cannot invent a violation', () => {
    const shifts = [
      {
        date: '2026-05-05',
        workedHours: 8,
        breakHours: 0.5,
        firstInAt: '2026-05-05T06:00:00Z',
      },
      {
        date: '2026-05-04',
        workedHours: 8,
        breakHours: 0.5,
        lastOutAt: '2026-05-04T22:00:00Z',
      },
    ]

    const violations = evaluateWorkingTime({ shifts })

    assert.equal(violations.length, 1)
    assert.equal(violations[0]?.rule, 'rest-period')
    assert.equal(violations[0]?.date, '2026-05-05')
  })

  it('measures rest against the preceding shift across a gap in the data', () => {
    // Friday to Monday is far more than eleven hours, so a weekend gap is not a violation.
    const violations = evaluateWorkingTime({
      shifts: [
        {
          date: '2026-05-01',
          workedHours: 8,
          breakHours: 0.5,
          lastOutAt: '2026-05-01T17:00:00Z',
        },
        {
          date: '2026-05-04',
          workedHours: 8,
          breakHours: 0.5,
          firstInAt: '2026-05-04T08:00:00Z',
        },
      ],
    })

    assert.deepEqual(violations, [])
  })

  it('reports every rule a single shift breaks', () => {
    const violations = evaluateWorkingTime({
      shifts: [
        {
          date: '2026-05-04',
          workedHours: 8,
          breakHours: 0.5,
          lastOutAt: '2026-05-04T23:00:00Z',
        },
        {
          date: '2026-05-05',
          workedHours: 11,
          breakHours: 0,
          firstInAt: '2026-05-05T05:00:00Z',
        },
      ],
    })

    assert.deepEqual(
      violations
        .filter((item) => item.date === '2026-05-05')
        .map((i) => i.rule),
      ['break', 'max-daily-hours', 'rest-period']
    )
  })
})
