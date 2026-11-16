import type {
  ApiOnboardingStateDto,
  ApiOnboardingStepKey,
} from '@/contracts/api'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  COUNTRY_OPTIONS,
  getActiveStep,
  getDefaultAnnualLeaveDays,
  getDefaultTimeZoneForCountry,
  getNextStep,
  getPreviousStep,
  getProgressPercent,
  getRegionOptions,
  getWizardSteps,
  isOnboardingComplete,
  isOnboardingStepKey,
  isStepResolved,
  ONBOARDING_STEP_ORDER,
  parseInviteEmails,
  validateAnnualLeaveDays,
  validateWeeklyHours,
} from './onboarding-view-model'

function state(
  resolved: Partial<Record<ApiOnboardingStepKey, { skipped?: boolean }>> = {},
  overrides: Partial<ApiOnboardingStateDto> = {}
): ApiOnboardingStateDto {
  const steps = ONBOARDING_STEP_ORDER.map((step) => ({
    resolved: step in resolved,
    resolvedAt: step in resolved ? '2026-07-30T08:00:00+00:00' : null,
    skipped: resolved[step]?.skipped ?? false,
    step,
  }))

  return {
    completedAt: null,
    currentStep:
      ONBOARDING_STEP_ORDER.find((step) => !(step in resolved)) ?? null,
    status: 'in-progress',
    steps,
    ...overrides,
  }
}

describe('onboarding view model', () => {
  it('starts on the company step for a fresh workspace', () => {
    assert.equal(getActiveStep(state()), 'company')
  })

  it('advances the active step as steps resolve', () => {
    assert.equal(getActiveStep(state({ company: {} })), 'team')
    assert.equal(getActiveStep(state({ company: {}, team: {} })), 'absences')
  })

  it('honours an explicitly requested step so users can navigate back', () => {
    assert.equal(getActiveStep(state({ company: {} }), 'company'), 'company')
  })

  it('ignores an unknown requested step', () => {
    assert.equal(getActiveStep(state({ company: {} }), 'nonsense'), 'team')
  })

  it('falls back to the first unresolved step when the server sends no current step', () => {
    const withoutCurrent = state({ company: {} }, { currentStep: null })

    assert.equal(getActiveStep(withoutCurrent), 'team')
  })

  it('falls back to the first step when there is no state at all', () => {
    assert.equal(getActiveStep(null), 'company')
  })

  it('marks resolved, skipped, current and upcoming steps', () => {
    const steps = getWizardSteps(
      state({ company: {}, team: { skipped: true } }),
      'absences'
    )

    assert.deepEqual(
      steps.map((step) => [step.key, step.status]),
      [
        ['company', 'done'],
        ['team', 'skipped'],
        ['absences', 'current'],
        ['first-clock-in', 'upcoming'],
      ]
    )
  })

  it('treats the active step as current even when already resolved', () => {
    const steps = getWizardSteps(state({ company: {} }), 'company')

    assert.equal(steps[0]?.status, 'current')
  })

  it('marks only the company step as required', () => {
    const steps = getWizardSteps(state(), 'company')

    assert.deepEqual(
      steps.map((step) => step.isOptional),
      [false, true, true, true]
    )
  })

  it('exposes translation keys rather than hardcoded copy', () => {
    const steps = getWizardSteps(state(), 'company')

    assert.equal(steps[3]?.titleKey, 'onboardingUi.steps.firstClockIn.title')
    assert.equal(
      steps[3]?.descriptionKey,
      'onboardingUi.steps.firstClockIn.description'
    )
  })

  it('reports progress across the four steps', () => {
    assert.equal(getProgressPercent(state()), 0)
    assert.equal(getProgressPercent(state({ company: {} })), 25)
    assert.equal(getProgressPercent(state({ company: {}, team: {} })), 50)
  })

  it('reports full progress once onboarding is complete', () => {
    const completed = state({}, { status: 'completed' })

    assert.equal(getProgressPercent(completed), 100)
    assert.ok(isOnboardingComplete(completed))
  })

  it('counts a skipped step as progress', () => {
    assert.equal(getProgressPercent(state({ company: { skipped: true } })), 25)
  })

  it('navigates between steps and stops at the ends', () => {
    assert.equal(getNextStep('company'), 'team')
    assert.equal(getNextStep('first-clock-in'), null)
    assert.equal(getPreviousStep('team'), 'company')
    assert.equal(getPreviousStep('company'), null)
  })

  it('recognises valid step keys', () => {
    assert.ok(isOnboardingStepKey('absences'))
    assert.ok(!isOnboardingStepKey('billing'))
    assert.ok(!isOnboardingStepKey(undefined))
  })

  it('reads resolution state defensively', () => {
    assert.ok(!isStepResolved(null, 'company'))
    assert.ok(isStepResolved(state({ company: {} }), 'company'))
  })
})

describe('company step inputs', () => {
  it('accepts weekly hours with comma or dot decimals', () => {
    assert.deepEqual(validateWeeklyHours('38,5'), { ok: true, value: 38.5 })
    assert.deepEqual(validateWeeklyHours('40'), { ok: true, value: 40 })
    assert.deepEqual(validateWeeklyHours(' 37.5 '), { ok: true, value: 37.5 })
  })

  it('rejects weekly hours outside the legal range', () => {
    assert.deepEqual(validateWeeklyHours('0'), {
      messageKey: 'onboardingUi.errors.weeklyHoursRange',
      ok: false,
    })
    assert.deepEqual(validateWeeklyHours('61'), {
      messageKey: 'onboardingUi.errors.weeklyHoursRange',
      ok: false,
    })
  })

  it('rejects empty or non numeric weekly hours', () => {
    assert.deepEqual(validateWeeklyHours(''), {
      messageKey: 'onboardingUi.errors.weeklyHoursRequired',
      ok: false,
    })
    assert.deepEqual(validateWeeklyHours('full time'), {
      messageKey: 'onboardingUi.errors.weeklyHoursRequired',
      ok: false,
    })
  })

  it('offers the sixteen German Bundeslaender as ISO subdivisions', () => {
    const regions = getRegionOptions('DE')

    assert.equal(regions.length, 16)
    assert.ok(regions.some((region) => region.code === 'DE-SL'))
    assert.ok(regions.every((region) => region.code.startsWith('DE-')))
  })

  it('returns no regions for an unknown country', () => {
    assert.deepEqual(getRegionOptions('US'), [])
    assert.deepEqual(getRegionOptions(null), [])
  })

  it('defaults the time zone from the country', () => {
    assert.equal(getDefaultTimeZoneForCountry('DE'), 'Europe/Berlin')
    assert.equal(getDefaultTimeZoneForCountry('AT'), 'Europe/Vienna')
    assert.equal(getDefaultTimeZoneForCountry(null), 'Europe/Berlin')
  })

  it('covers the DACH region', () => {
    assert.deepEqual(
      COUNTRY_OPTIONS.map((country) => country.code),
      ['DE', 'AT', 'CH']
    )
  })
})

describe('invite parsing', () => {
  it('accepts the separators people actually paste', () => {
    const result = parseInviteEmails(
      'anna@acme.de, ben@acme.de\ncara@acme.de; dave@acme.de eve@acme.de'
    )

    assert.deepEqual(result.valid, [
      'anna@acme.de',
      'ben@acme.de',
      'cara@acme.de',
      'dave@acme.de',
      'eve@acme.de',
    ])
    assert.deepEqual(result.invalid, [])
  })

  it('lowercases and collapses duplicates', () => {
    const result = parseInviteEmails('Anna@Acme.de, anna@acme.de')

    assert.deepEqual(result.valid, ['anna@acme.de'])
  })

  it('separates addresses it cannot accept', () => {
    const result = parseInviteEmails('anna@acme.de, not-an-email, ben@acme')

    assert.deepEqual(result.valid, ['anna@acme.de'])
    assert.deepEqual(result.invalid, ['not-an-email', 'ben@acme'])
  })

  it('handles empty input', () => {
    assert.deepEqual(parseInviteEmails('   '), { invalid: [], valid: [] })
  })
})

describe('absence quotas', () => {
  it('defaults to the statutory minimum for the country', () => {
    assert.equal(getDefaultAnnualLeaveDays('DE'), 20)
    assert.equal(getDefaultAnnualLeaveDays('AT'), 25)
    assert.equal(getDefaultAnnualLeaveDays(null), 20)
  })

  it('accepts half days', () => {
    assert.deepEqual(validateAnnualLeaveDays('27,5'), { ok: true, value: 27.5 })
  })

  it('rejects values outside a plausible range', () => {
    assert.deepEqual(validateAnnualLeaveDays('-1'), {
      messageKey: 'onboardingUi.errors.leaveDaysRange',
      ok: false,
    })
    assert.deepEqual(validateAnnualLeaveDays('61'), {
      messageKey: 'onboardingUi.errors.leaveDaysRange',
      ok: false,
    })
  })

  it('rejects non numeric input', () => {
    assert.deepEqual(validateAnnualLeaveDays('lots'), {
      messageKey: 'onboardingUi.errors.leaveDaysRequired',
      ok: false,
    })
  })
})
