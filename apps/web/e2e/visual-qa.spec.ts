import { expect, test, type Page } from '@playwright/test'

async function signInAsSuperadmin(page: Page) {
  await page.goto('/sign-in')
  await page
    .getByLabel(/^(Email|E-Mail)$/i)
    .fill('founder@flowpro.local')
  await page
    .getByRole('textbox', { name: /^(Password|Passwort)$/i })
    .fill('superadmin')
  await page
    .getByRole('button', { name: /^(Sign in|Anmelden)$/i })
    .click()
  await expect(page.getByRole('heading', { name: /^(Today|Heute)$/i })).toBeVisible()
}

const viewports = [
  { label: 'mobile', size: { width: 390, height: 844 } },
  { label: 'tablet', size: { width: 1024, height: 1366 } },
  { label: 'desktop', size: { width: 1536, height: 960 } },
]

const routes = [
  { name: 'today', path: '/' },
  { name: 'requests', path: '/requests' },
  { name: 'timesheet', path: '/timesheet' },
  { name: 'planning', path: '/planning' },
  { name: 'team-availability', path: '/team-availability' },
  { name: 'reports', path: '/reports' },
  { name: 'users', path: '/users' },
  { name: 'audit', path: '/audit' },
  { name: 'settings-profile', path: '/settings' },
  { name: 'settings-account', path: '/settings/account' },
  { name: 'settings-appearance', path: '/settings/appearance' },
  { name: 'settings-display', path: '/settings/display' },
  { name: 'settings-notifications', path: '/settings/notifications' },
  { name: 'settings-attendance', path: '/settings/attendance' },
]

test.describe('visual QA screenshots', () => {
  for (const viewport of viewports) {
    test(`captures core pages on ${viewport.label}`, async ({ page }) => {
      // Each viewport loads every route and takes a full-page screenshot, so the
      // budget scales with route count, not with any single assertion. The
      // desktop pass measured ~78s on an idle machine against the previous 90s
      // limit; that headroom was too thin for a CI runner and produced timeouts
      // that looked like product failures.
      test.setTimeout(180_000)
      await page.setViewportSize(viewport.size)
      await signInAsSuperadmin(page)

      for (const route of routes) {
        await page.goto(route.path)
        await expect(page.locator('main')).toBeVisible()
        await page.waitForTimeout(250)
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth + 1
        )
        await page.screenshot({
          fullPage: true,
          path: `test-results/visual-qa/${viewport.label}-${route.name}.png`,
        })
      }
    })
  }
})
