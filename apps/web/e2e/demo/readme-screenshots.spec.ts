import { expect, test, type Page } from '@playwright/test'

/**
 * Retakes the README screenshots from the seeded public demo, so they only ever
 * show fictional people. Skipped unless FLOWPRO_CAPTURE_SCREENSHOTS=true:
 *
 *   FLOWPRO_CAPTURE_SCREENSHOTS=true npm run test:e2e:demo -- --grep "README screenshots"
 */

const capture = process.env.FLOWPRO_CAPTURE_SCREENSHOTS === 'true'
const directory = '../../docs/assets/screenshots'

test.describe('README screenshots', () => {
  test.skip(!capture, 'Set FLOWPRO_CAPTURE_SCREENSHOTS=true to retake them.')
  test.use({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1.2,
    colorScheme: 'light',
  })

  test('captures Today and the approval queue', async ({ page }) => {
    await signInAs(page, 'Admin')
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /^Today$/ })).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${directory}/today.png` })

    await page.context().clearCookies()
    await signInAs(page, 'Manager')
    await page.goto('/requests')
    await page.getByRole('tab', { name: 'Approvals' }).click()
    await expect(page.getByText('Jamie Chen').first()).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${directory}/requests.png` })
  })
})

async function signInAs(page: Page, role: 'Admin' | 'Manager') {
  await page.goto('/sign-in')
  await page.getByRole('button', { name: new RegExp(`Sign in as ${role}`) }).click()
  await expect(page).not.toHaveURL(/\/sign-in/)
}

// Lets the sync feed deliver the demo's records and the charts finish drawing.
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_500)
}
