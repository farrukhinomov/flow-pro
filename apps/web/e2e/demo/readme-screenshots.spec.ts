import { expect, test } from '@playwright/test'

/**
 * Retakes the README screenshot from the seeded public demo, signed in as its
 * admin, so it only ever shows fictional people. Skipped unless
 * FLOWPRO_CAPTURE_SCREENSHOTS=true:
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

  test('captures Today', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: /Sign in as Admin/ }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /^Today$/ })).toBeVisible()
    // Lets the sync feed deliver the demo's records and the charts finish drawing.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1_500)
    await page.screenshot({ path: `${directory}/today.png` })
  })
})
