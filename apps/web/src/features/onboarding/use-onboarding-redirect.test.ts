import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isAccountPage,
  isOnOnboardingWizard,
  shouldRedirectToOnboarding,
} from './use-onboarding-redirect'

describe('onboarding redirect decision', () => {
  it('sends an unfinished workspace to the wizard', () => {
    assert.equal(
      shouldRedirectToOnboarding({ needsSetup: true, pathname: '/' }),
      true
    )
    assert.equal(
      shouldRedirectToOnboarding({ needsSetup: true, pathname: '/reports' }),
      true
    )
  })

  it('leaves a finished workspace alone', () => {
    assert.equal(
      shouldRedirectToOnboarding({ needsSetup: false, pathname: '/' }),
      false
    )
  })

  it('never redirects the wizard to itself', () => {
    // The wizard renders inside the authenticated shell, so without this the
    // check would loop forever on the one screen that needs it.
    assert.equal(
      shouldRedirectToOnboarding({
        needsSetup: true,
        pathname: '/onboarding',
      }),
      false
    )
  })

  it('treats nested wizard paths as the wizard', () => {
    assert.ok(isOnOnboardingWizard('/onboarding'))
    assert.ok(isOnOnboardingWizard('/onboarding/company'))
    assert.ok(!isOnOnboardingWizard('/'))
    assert.ok(!isOnOnboardingWizard('/settings'))
  })

  it('keeps account security reachable before setup is finished', () => {
    assert.equal(
      shouldRedirectToOnboarding({
        needsSetup: true,
        pathname: '/settings/security',
      }),
      false
    )
    assert.ok(isAccountPage('/settings/security'))
    assert.ok(!isAccountPage('/settings'))
    assert.ok(!isAccountPage('/settings/securityx'))
  })
})
