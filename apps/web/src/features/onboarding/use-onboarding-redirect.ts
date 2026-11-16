import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { requiresOnboarding } from './onboarding-guard'

/**
 * Sends a workspace that still needs setup to the wizard, without blocking the
 * shell on a network round-trip.
 *
 * This check used to live in the `_authenticated` route's `beforeLoad`, awaited
 * before anything rendered. That made every authenticated page's first paint
 * wait on `GET /onboarding/state`: when that request was slow, the entire
 * application - navigation included - stayed blank, and the failure surfaced as
 * "no `<main>` element" rather than as anything resembling its cause.
 *
 * Deferring it is safe because this is a routing convenience, not an
 * authorization boundary. The session check stays synchronous in `beforeLoad`,
 * and the backend scopes every request to the caller's tenant regardless of
 * which screen the browser happens to show.
 *
 * The trade is that a workspace needing setup may see the shell for one frame
 * before being moved. That affects the first minutes of a workspace's life,
 * where the screen behind is empty anyway; the previous behaviour taxed every
 * navigation for every user forever.
 */
/**
 * The wizard lives inside the authenticated shell, so it must never send itself
 * back to itself - that would be an infinite redirect. Pure so this condition
 * is covered by a test rather than only by the browser.
 */
export function isOnOnboardingWizard(pathname: string) {
  return pathname.startsWith('/onboarding')
}

/**
 * Pages about the person's own account rather than the workspace. They stay reachable before
 * setup is finished: someone who suspects their password leaked must be able to change it and
 * end other sessions without first configuring the company.
 */
export function isAccountPage(pathname: string) {
  return (
    pathname === '/settings/security' ||
    pathname.startsWith('/settings/security/')
  )
}

export function shouldRedirectToOnboarding({
  needsSetup,
  pathname,
}: {
  needsSetup: boolean
  pathname: string
}) {
  return (
    needsSetup && !isOnOnboardingWizard(pathname) && !isAccountPage(pathname)
  )
}

export function useOnboardingRedirect() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isExempt = isOnOnboardingWizard(pathname) || isAccountPage(pathname)

  useEffect(() => {
    if (isExempt) return

    let cancelled = false

    void requiresOnboarding().then((needsSetup) => {
      if (cancelled || !shouldRedirectToOnboarding({ needsSetup, pathname })) {
        return
      }

      void navigate({ replace: true, to: '/onboarding' })
    })

    return () => {
      cancelled = true
    }
  }, [isExempt, navigate, pathname])
}
