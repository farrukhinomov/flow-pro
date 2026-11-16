import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

/**
 * The real sign-in path: an API in Session mode, an HttpOnly session cookie, and email links
 * delivered through Mailpit. Run with `npm run test:e2e:session`.
 */

const mailpitUrl =
  process.env.FLOWPRO_E2E_MAILPIT_URL ?? 'http://127.0.0.1:8025'
const founder = {
  email: 'founder@flowpro.local',
  name: 'Marta Lindgren',
  password: 'superadmin',
}

// One account is registered by the suite and reused, so the tests run in order.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const newAccount = {
  email: `e2e-session-${runId}@flowpro.test`,
  name: 'Session Tester',
  newEmail: `e2e-session-${runId}-moved@flowpro.test`,
  password: 'first e2e passphrase',
  resetPassword: 'second e2e passphrase',
  changedPassword: 'third e2e passphrase',
}

test.describe('session authentication', () => {
  test.describe.configure({ mode: 'serial' })

  test('signs in with an HttpOnly cookie and signs out on the server', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/sign-in/)

    await fillSignIn(page, founder.email, 'not the password')
    await expect(
      page.getByText('The email or password is incorrect.').first()
    ).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in/)

    await fillSignIn(page, founder.email, founder.password)
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    const sessionCookie = (await context.cookies()).find(
      (cookie) => cookie.name === 'flowpro_session'
    )
    expect(sessionCookie, 'session cookie').toBeDefined()
    expect(sessionCookie?.httpOnly).toBe(true)
    expect(sessionCookie?.sameSite).toBe('Lax')
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      'flowpro_session'
    )
    expect((await page.request.get('/api/v1/auth/account')).status()).toBe(200)

    await page
      .getByRole('button', { name: new RegExp(founder.name) })
      .first()
      .click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Sign out' })
      .click()

    await expect(page).toHaveURL(/\/sign-in/)
    expect((await page.request.get('/api/v1/auth/account')).status()).toBe(401)
  })

  test('registers, creates a workspace and confirms the email from the link', async ({
    page,
  }) => {
    await page.goto('/sign-up')
    await page.getByLabel('Your name').fill(newAccount.name)
    await page.getByLabel('Email').fill(newAccount.email)
    await page.getByLabel('Password').fill(newAccount.password)
    await page.getByRole('button', { name: 'Create your workspace' }).click()

    await expect(page).toHaveURL(/\/claim-workspace/)
    await page.getByLabel('Workspace name').fill(`Session e2e ${runId}`)
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page).toHaveURL(/\/onboarding/)

    const link = await waitForEmailLink(
      newAccount.email,
      'Confirm your FlowPro email address'
    )
    await page.goto(link)
    await expect(
      page.getByText('Your email address is confirmed.')
    ).toBeVisible()
    // The token must not stay in the address bar or the history.
    await expect(page).not.toHaveURL(/token=/)

    await page.goto('/settings/security')
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
  })

  test('resets a forgotten password from the emailed link', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    // Wait for the new page, or the fill can land in the sign-in form on its way out.
    await expect(page).toHaveURL(/\/forgot-password/)
    await page.getByLabel('Email').fill(newAccount.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText(/we sent it a link/)).toBeVisible()

    const link = await waitForEmailLink(
      newAccount.email,
      'Reset your FlowPro password'
    )
    await page.goto(link)
    await expect(page).not.toHaveURL(/token=/)
    await page.getByLabel('New password').fill(newAccount.resetPassword)
    await page.getByRole('button', { name: 'Set new password' }).click()
    await expect(page).toHaveURL(/\/sign-in/)

    // A reset link works once.
    await page.goto(link)
    await page.getByLabel('New password').fill('a fourth e2e passphrase')
    await page.getByRole('button', { name: 'Set new password' }).click()
    await expect(
      page.getByText('This link is invalid or has expired.', { exact: false })
    ).toBeVisible()

    await page.goto('/sign-in')
    await fillSignIn(page, newAccount.email, newAccount.password)
    await expect(
      page.getByText('The email or password is incorrect.').first()
    ).toBeVisible()

    await fillSignIn(page, newAccount.email, newAccount.resetPassword)
    await expect(page).not.toHaveURL(/\/sign-in/)
  })

  test('changing the password keeps this session and ends the others', async ({
    page,
    baseURL,
  }) => {
    const otherDevice = await signInThroughApi(
      baseURL,
      newAccount.email,
      newAccount.resetPassword
    )

    try {
      await page.goto('/sign-in')
      await fillSignIn(page, newAccount.email, newAccount.resetPassword)
      await expect(page).not.toHaveURL(/\/sign-in/)

      await page.goto('/settings/security')
      const passwordForm = settingsSection(page, 'Change password')
      await passwordForm
        .getByLabel('Current password')
        .fill(newAccount.resetPassword)
      await passwordForm
        .getByLabel('New password')
        .fill(newAccount.changedPassword)
      await passwordForm.getByRole('button', { name: 'Change password' }).click()
      await expect(
        page.getByText(/Other sessions signed out: [1-9]/).first()
      ).toBeVisible()

      expect((await otherDevice.get('/api/v1/auth/account')).status()).toBe(
        401
      )
      expect((await page.request.get('/api/v1/auth/account')).status()).toBe(
        200
      )

      // Only this device is left, so there is nothing else to sign out.
      await page.reload()
      await expect(page.getByText('This device')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Sign out everywhere else' })
      ).toHaveCount(0)
    } finally {
      await otherDevice.dispose()
    }

    const oldPassword = await playwrightRequest.newContext({ baseURL })
    try {
      const response = await oldPassword.post('/api/v1/auth/sign-in', {
        data: { email: newAccount.email, password: newAccount.resetPassword },
      })
      expect(response.ok()).toBe(false)
    } finally {
      await oldPassword.dispose()
    }
  })

  test('moves the account to a new email address once the link is opened', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await fillSignIn(page, newAccount.email, newAccount.changedPassword)
    await expect(page).not.toHaveURL(/\/sign-in/)

    await page.goto('/settings/security')
    const emailForm = settingsSection(page, 'Change email address')
    await emailForm.getByLabel('New email address').fill(newAccount.newEmail)
    await emailForm
      .getByLabel('Current password')
      .fill(newAccount.changedPassword)
    await emailForm
      .getByRole('button', { name: 'Change email address' })
      .click()
    await expect(
      page.getByText(`Check ${newAccount.newEmail}`).first()
    ).toBeVisible()

    // Nothing changes before the link is opened.
    await expect(page.getByText(newAccount.email).first()).toBeVisible()

    const link = await waitForEmailLink(
      newAccount.newEmail,
      'Confirm your new FlowPro email address'
    )
    await page.goto(link)
    await expect(
      page.getByText(`Your account now uses ${newAccount.newEmail}`)
    ).toBeVisible()
    await expect(page).not.toHaveURL(/token=/)

    await waitForEmail(newAccount.email, 'Your FlowPro email address was changed')

    const signIn = await playwrightRequest.newContext({
      baseURL: page.url(),
    })
    try {
      const oldAddress = await signIn.post('/api/v1/auth/sign-in', {
        data: { email: newAccount.email, password: newAccount.changedPassword },
      })
      expect(oldAddress.ok()).toBe(false)
      const newAddress = await signIn.post('/api/v1/auth/sign-in', {
        data: {
          email: newAccount.newEmail,
          password: newAccount.changedPassword,
        },
      })
      expect(newAddress.status()).toBe(200)
    } finally {
      await signIn.dispose()
    }
  })
})

/** A titled section of a settings page, so fields that repeat across sections stay distinct. */
function settingsSection(page: Page, title: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

async function fillSignIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** A second device: its own cookie jar, signed in over the API like a script would. */
async function signInThroughApi(
  baseURL: string | undefined,
  email: string,
  password: string
): Promise<APIRequestContext> {
  const device = await playwrightRequest.newContext({ baseURL })
  const response = await device.post('/api/v1/auth/sign-in', {
    data: { email, password },
  })
  expect(response.status(), await response.text()).toBe(200)
  expect((await device.get('/api/v1/auth/account')).status()).toBe(200)
  return device
}

type MailpitSearch = {
  messages: { ID: string; Subject: string; Created: string }[]
}

/** Waits for the newest email with this subject and returns its text. */
async function waitForEmail(to: string, subject: string) {
  const mailpit = await playwrightRequest.newContext({ baseURL: mailpitUrl })

  try {
    let text: string | undefined

    await expect
      .poll(
        async () => {
          const search = await mailpit.get('/api/v1/search', {
            params: { query: `to:"${to}" subject:"${subject}"` },
          })
          if (!search.ok()) return undefined

          const { messages } = (await search.json()) as MailpitSearch
          const newest = messages[0]
          if (!newest) return undefined

          const message = await mailpit.get(`/api/v1/message/${newest.ID}`)
          text = ((await message.json()) as { Text: string }).Text
          return text
        },
        { message: `email "${subject}" to ${to}`, timeout: 20_000 }
      )
      .toBeDefined()

    return text as string
  } finally {
    await mailpit.dispose()
  }
}

/** Waits for the newest email with this subject and returns the link in it. */
async function waitForEmailLink(to: string, subject: string) {
  const text = await waitForEmail(to, subject)
  const link = text.match(/https?:\/\/\S+#token=[\w-]+/)?.[0]
  expect(link, `link in "${subject}"`).toBeDefined()
  return link as string
}
