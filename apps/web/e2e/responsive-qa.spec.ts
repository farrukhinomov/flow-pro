import { expect, test, type Locator, type Page } from '@playwright/test'

const apiBaseUrl =
  process.env.FLOWPRO_E2E_API_BASE_URL ?? 'http://127.0.0.1:5124/api/v1'

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
  await expect(
    page.getByRole('heading', { name: /^(Today|Heute)$/i })
  ).toBeVisible()
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1
  )
}

async function expectTabVisibleAndClickable(_page: Page, tab: Locator) {
  await tab.scrollIntoViewIfNeeded()
  await expect(tab).toBeVisible()
  await tab.click()
  await expect(tab).toHaveAttribute('data-state', 'active')
}

test.describe('responsive QA behaviors', () => {
  test('keeps today primary actions visible on mobile', async ({
    page,
    request,
  }) => {
    const resetResponse = await request.post(
      `${apiBaseUrl}/development/reset-attendance`
    )
    expect(resetResponse.ok()).toBeTruthy()

    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsSuperadmin(page)

    const primaryAction = page.getByRole('button', {
      name: /^(Clock in|Einstempeln)$/i,
    })
    const newRequest = page.getByRole('link', {
      name: /^(New request|Neuer Antrag)$/i,
    })
    const timesheet = page.getByRole('link', {
      name: /^(Timesheet|Zeiterfassung)$/i,
    })

    await expect(primaryAction).toBeVisible()
    await expect(newRequest).toBeVisible()
    await expect(timesheet).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test('keeps request and settings tabs operable on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsSuperadmin(page)

    await page.goto('/requests')
    await expect(
      page.getByRole('heading', { name: /^(Requests|Anträge)$/i })
    ).toBeVisible()
    await expectTabVisibleAndClickable(
      page,
      page.getByRole('tab', { name: /^(History|Verlauf)$/i })
    )
    await expectTabVisibleAndClickable(
      page,
      page.getByRole('tab', { name: /^(Approvals|Freigaben)$/i })
    )

    await page.goto('/settings/attendance')
    await expect(
      page.getByRole('heading', {
        name: /^(Settings|Einstellungen)$/i,
      })
    ).toBeVisible()
    await expectTabVisibleAndClickable(
      page,
      page.getByRole('tab', { name: /^(Regelwerk|Rules engine)$/i })
    )
    await expectTabVisibleAndClickable(
      page,
      page.getByRole('tab', { name: /^(Sichtbarkeit|Visibility)$/i })
    )

    await expectNoPageOverflow(page)
  })

  test('keeps the timesheet ledger readable without an internal table scroll on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsSuperadmin(page)

    await page.goto('/timesheet')
    await expect(page.locator('main')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /^(Timesheet|Zeiterfassung)$/i })
    ).toBeVisible()
    await page.waitForTimeout(250)

    await expect(
      page.getByText(/^(My timesheets|Meine Zeiterfassung)$/i)
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^(Only exceptions|Nur Ausnahmen)/i })
    ).toBeVisible()
    await expect(page.locator('[data-slot="table-container"]')).toHaveCount(0)
    await expectNoPageOverflow(page)
  })

  test('uses internal scroll containers for wide admin and report tables on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsSuperadmin(page)

    for (const path of ['/users', '/reports']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(250)

      const tableContainer = page.locator('[data-slot="table-container"]').first()
      await expect(tableContainer).toBeVisible()

      const metrics = await tableContainer.evaluate((element) => {
        const htmlElement = element as HTMLElement
        const style = window.getComputedStyle(htmlElement)
        return {
          clientWidth: htmlElement.clientWidth,
          overflowX: style.overflowX,
          scrollWidth: htmlElement.scrollWidth,
        }
      })

      expect(['auto', 'scroll']).toContain(metrics.overflowX)
      expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth)
      await expectNoPageOverflow(page)
    }
  })
})
