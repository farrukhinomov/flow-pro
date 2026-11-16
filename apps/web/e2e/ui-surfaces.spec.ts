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

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = []

  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  return errors
}

test.describe('UI surface coverage', () => {
  test('renders public auth redirects and error pages', async ({ page }) => {
    // Sign-up stopped being a redirect when self-serve onboarding shipped: it is now the
    // public entry point that starts workspace provisioning, and it carries no email field
    // because the identity provider collects credentials.
    await page.goto('/sign-up')
    // Asserted on the page title rather than the primary action, because the action is
    // replaced by an explanatory alert wherever no identity provider is configured, which
    // is the case in this harness.
    await expect(page).toHaveURL(/\/sign-up/)
    await expect(
      page.getByText(/^(Start with FlowPro|Mit FlowPro starten)$/)
    ).toBeVisible()
    await expectNoPageOverflow(page)

    for (const path of ['/forgot-password', '/otp', '/sign-in-2']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in/)
      await expect(page.getByLabel(/^(Email|E-Mail)$/i)).toBeVisible()
      await expectNoPageOverflow(page)
    }

    for (const code of ['401', '403', '404', '500', '503']) {
      await page.goto(`/${code}`)
      await expect(page.getByRole('heading', { name: code })).toBeVisible()
      await expectNoPageOverflow(page)
    }
  })

  test('renders every authenticated route without page errors', async ({
    page,
  }) => {
    // Signs in and then loads every authenticated route, so the cost scales with the route
    // count rather than with any single assertion. On an idle machine the sweep measured
    // ~44s against the 60s default, and that headroom was thin enough that ordinary load
    // turned it into a timeout that looked like a product failure. The visual QA sweep
    // covers the same routes and already budgets 180s for this reason.
    test.setTimeout(180_000)
    const errors = collectUnexpectedErrors(page)
    const routes = [
      '/',
      '/requests',
      '/timesheet',
      '/planning',
      '/team-availability',
      '/reports',
      '/users',
      '/audit',
      '/settings',
      '/settings/account',
      '/settings/appearance',
      '/settings/display',
      '/settings/notifications',
      '/settings/attendance',
    ]

    await signInAsSuperadmin(page)

    for (const path of routes) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(200)
      await expectNoPageOverflow(page)
    }

    expect(errors).toEqual([])
  })

  test('keeps shell menus and global actions operable', async ({ page }) => {
    await signInAsSuperadmin(page)

    await page.getByRole('button', { name: /^(Toggle theme|Theme)$/i }).click()
    await expect(
      page.getByRole('menuitem', { name: /^(Dark|Dunkel)$/i })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: /^(System|Systemdesign)$/i }).click()

    await page.getByRole('button', { name: /^(Open sync status)$/i }).click()
    await expect(page.getByText(/^(Local sync|Lokale Synchronisierung)$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Retry|Erneut versuchen)$/i })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.locator('header').getByRole('button', { name: /^ML$/ }).click()
    await expect(
      page.getByRole('menuitem', { name: /^(Profile|Profil)/i })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /^(People workspace|Personenbereich)$/i })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: /^(Sign out|Abmelden)/i }).click()
    await expect(
      page.getByRole('alertdialog', { name: /^(Sign out|Abmelden)$/i })
    ).toBeVisible()
    await page.getByRole('button', { name: /^(Cancel|Abbrechen)$/i }).click()
  })

  test('keeps admin and settings controls operable', async ({ page }) => {
    await signInAsSuperadmin(page)

    await page.goto('/users')
    for (const tab of [
      /^(Overview|Übersicht)$/i,
      /^(Organization|Organisation)$/i,
      /^(Permissions|Berechtigungen)$/i,
      /^(Directory|Verzeichnis)$/i,
    ]) {
      const trigger = page.getByRole('tab', { name: tab })
      await trigger.click()
      await expect(trigger).toHaveAttribute('data-state', 'active')
    }

    await page.getByRole('button', { name: /^(Invite|Einladen)$/i }).click()
    await expect(
      page.getByRole('heading', {
        name: /^(Invite employee|Mitarbeiter einladen)$/i,
      })
    ).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Close|Schließen)$/i })
      .first()
      .click()

    await page
      .getByRole('button', { name: /^(Add employee|Mitarbeiter hinzufügen)$/i })
      .click()
    await expect(
      page.getByRole('heading', {
        name: /^(Create employee profile|Mitarbeiterprofil erstellen)$/i,
      })
    ).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Close|Schließen)$/i })
      .first()
      .click()

    await page.goto('/settings/attendance')
    for (const tab of [
      /^(Rules engine|Regelwerk)$/i,
      /^(Visibility|Sichtbarkeit)$/i,
      /^(Statuses|Statusarten)$/i,
    ]) {
      const trigger = page.getByRole('tab', { name: tab })
      await trigger.click()
      await expect(trigger).toHaveAttribute('data-state', 'active')
    }

    await page.goto('/settings/display')
    await page.getByRole('checkbox').first().click()
    await page
      .getByRole('button', { name: /^(Update display|Anzeige aktualisieren)$/i })
      .click()
    await expect(
      page.getByText(/^(Display preferences updated\.|Anzeigeeinstellungen aktualisiert\.)$/i)
    ).toBeVisible()

    await page.goto('/settings/notifications')
    await page
      .getByRole('button', {
        name: /^(Update notifications|Benachrichtigungen aktualisieren)$/i,
      })
      .click()
    await expect(
      page.getByText(/^(Notification preferences updated\.|Benachrichtigungseinstellungen aktualisiert\.)$/i)
    ).toBeVisible()
  })
})
