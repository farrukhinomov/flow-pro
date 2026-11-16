import { expect, test, type Page } from '@playwright/test'

async function signInAsSuperadmin(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel(/^(Email|E-Mail)$/i).fill('founder@flowpro.local')
  await page
    .getByRole('textbox', { name: /^(Password|Passwort)$/i })
    .fill('superadmin')
  await page.getByRole('button', { name: /^(Sign in|Anmelden)$/i }).click()
  await expect(
    page.getByRole('heading', { name: /^(Today|Heute)$/i })
  ).toBeVisible()
}

/**
 * Ceiling for a route to paint its shell, measured against the dev server.
 *
 * Deliberately loose. This is a regression alarm, not a target: it exists to
 * catch a page becoming multiples slower, not to police a few hundred
 * milliseconds. Routes normally land well under a second here, so this leaves
 * roughly an order of magnitude of headroom and will not itself become flaky on
 * a loaded CI runner.
 *
 * Two real defects motivated it, both invisible to every other gate:
 *
 * - A formatter memoized on `JSON.stringify(options)` made Reports take ~25s
 *   instead of ~4s. Lint, types, unit tests, and the build were all green.
 * - The authenticated layout awaited `GET /onboarding/state` before rendering,
 *   so every page's first paint waited on a network round-trip.
 *
 * Both surfaced only as "element not found" after a 10s visibility timeout,
 * which reads as a broken page rather than a slow one and cost hours to trace.
 * A budget failure names the route and the number instead.
 */
const FIRST_PAINT_BUDGET_MS = 8_000

const routes = [
  { name: 'today', path: '/' },
  { name: 'requests', path: '/requests' },
  { name: 'timesheet', path: '/timesheet' },
  { name: 'planning', path: '/planning' },
  { name: 'team-availability', path: '/team-availability' },
  { name: 'reports', path: '/reports' },
  { name: 'users', path: '/users' },
  { name: 'audit', path: '/audit' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-account', path: '/settings/account' },
  { name: 'settings-notifications', path: '/settings/notifications' },
  { name: 'settings-attendance', path: '/settings/attendance' },
]

test.describe('performance budget', () => {
  test('every authenticated route paints its shell within budget', async ({
    page,
  }) => {
    // One navigation per route, plus sign-in, against a cold dev server.
    test.setTimeout(180_000)
    await signInAsSuperadmin(page)

    const measurements: { name: string; ms: number }[] = []

    for (const route of routes) {
      const startedAt = Date.now()

      await page.goto(route.path)
      // The shell is what the budget covers: navigation, layout, and the route
      // component committing. Data loading fills in afterwards and is measured
      // by the workflows that depend on it.
      await expect(page.locator('main')).toBeVisible({
        timeout: FIRST_PAINT_BUDGET_MS,
      })

      measurements.push({ ms: Date.now() - startedAt, name: route.name })
    }

    const slowest = [...measurements].sort((first, second) => second.ms - first.ms)

    // Attached rather than logged, so a gradual creep is recorded on every run
    // and visible in the CI report before it ever breaches the ceiling.
    await test.info().attach('first-paint-ms', {
      body: slowest.map(({ ms, name }) => `${name}=${ms}`).join('\n'),
      contentType: 'text/plain',
    })

    const overBudget = measurements.filter(
      ({ ms }) => ms > FIRST_PAINT_BUDGET_MS
    )

    expect(
      overBudget,
      `routes over the ${FIRST_PAINT_BUDGET_MS}ms first-paint budget: ${overBudget
        .map(({ ms, name }) => `${name}=${ms}ms`)
        .join(', ')}`
    ).toEqual([])
  })
})
