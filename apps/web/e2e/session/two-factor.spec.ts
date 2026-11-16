import { createHmac } from 'node:crypto'
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

/**
 * Two-step sign-in with an authenticator app, on the real session path. Run with
 * `npm run test:e2e:session`. The test computes codes the way an authenticator app does.
 */

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `e2e-two-step-${runId}@flowpro.test`
const password = 'two step e2e passphrase'

test('an account turns on two-step sign-in, signs in with codes and turns it off', async ({
  page,
  baseURL,
}) => {
  // Waiting for a fresh 30-second code can take most of a period.
  test.setTimeout(120_000)
  await registerWithWorkspace(baseURL, `Two-step e2e ${runId}`)

  await signInWithPassword(page)
  await expect(page).not.toHaveURL(/\/sign-in/)

  // Turn it on: password, scan (here: read the key), confirm with a code.
  await page.goto('/settings/security')
  const section = settingsSection(page, 'Two-step sign-in')
  await section
    .getByRole('button', { name: 'Set up two-step sign-in' })
    .click()
  await section.getByLabel('Current password').fill(password)
  await section.getByRole('button', { name: 'Continue' }).click()
  await expect(
    section.getByRole('img', { name: 'QR code for your authenticator app' })
  ).toBeVisible()
  const key = base32Decode(
    await section.getByTestId('authenticator-key').innerText()
  )
  const enabledStep = timeStep()
  await section.getByLabel('Code from the app').fill(totp(key, enabledStep))
  await section.getByRole('button', { name: 'Turn on' }).click()

  const codeList = section.getByTestId('recovery-codes').locator('li')
  await expect(codeList).toHaveCount(10)
  const codes = (await codeList.allInnerTexts()).map((code) => code.trim())
  await section.getByRole('button', { name: 'I saved them' }).click()
  await expect(section.getByText('Unused recovery codes: 10.')).toBeVisible()

  // The password alone now leads to the code page, and a recovery code works once.
  await signOut(page)
  await signInWithPassword(page)
  await expect(page).toHaveURL(/\/two-factor/)
  const cookies = await page.context().cookies()
  const challenge = cookies.find((cookie) =>
    cookie.name.endsWith('flowpro_two_factor')
  )
  expect(challenge?.httpOnly).toBe(true)
  expect(challenge?.sameSite).toBe('Strict')
  expect(
    cookies.some((cookie) => cookie.name.endsWith('flowpro_session'))
  ).toBe(false)
  await page
    .getByRole('button', { name: 'Use a recovery code instead' })
    .click()
  await page.getByLabel('Recovery code').fill(codes[0])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expectSignedIn(page)

  // A wrong code is refused; the app's next code signs in.
  await signOut(page)
  await signInWithPassword(page)
  await expect(page).toHaveURL(/\/two-factor/)
  await page.getByLabel('Code from the app').fill('000000')
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(
    page.getByText('That code is incorrect. Try the current one.')
  ).toBeVisible()
  await page
    .getByLabel('Code from the app')
    .fill(totp(key, await waitForStepAfter(enabledStep)))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expectSignedIn(page)

  // Turning it off needs the password; afterwards the password alone signs in again.
  await page.goto('/settings/security')
  await expect(section.getByText('Unused recovery codes: 9.')).toBeVisible()
  await section.getByRole('button', { name: 'Turn off' }).click()
  await section.getByLabel('Current password').fill(password)
  await section.getByRole('button', { name: 'Turn off' }).click()
  await expect(section.getByText('Off', { exact: true })).toBeVisible()

  await signOut(page)
  await signInWithPassword(page)
  await expectSignedIn(page)
})

/**
 * Off the sign-in pages with a session for this account. A brand-new workspace may land on its
 * onboarding page instead of Today, so the page itself is not checked.
 */
async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/(sign-in|two-factor)/)
  await expect
    .poll(async () => (await page.request.get('/api/v1/auth/session')).status())
    .toBe(200)
  expect((await currentSession(page.request)).email).toBe(email)
}

async function signInWithPassword(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function signOut(page: Page) {
  await page
    .getByRole('button', { name: /Two Step Person/ })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Sign out' })
    .click()
  await expect(page).toHaveURL(/\/sign-in/)
}

function settingsSection(page: Page, title: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

async function registerWithWorkspace(
  baseURL: string | undefined,
  workspaceName: string
) {
  const owner = await playwrightRequest.newContext({ baseURL })
  try {
    const registered = await owner.post('/api/v1/auth/register', {
      data: { email, password, displayName: 'Two Step Person' },
    })
    expect(registered.status(), await registered.text()).toBe(201)
    const claimed = await owner.post('/api/v1/onboarding/workspace', {
      data: { workspaceName },
    })
    expect(claimed.ok(), await claimed.text()).toBe(true)
  } finally {
    await owner.dispose()
  }
}

async function currentSession(context: APIRequestContext) {
  const response = await context.get('/api/v1/auth/session')
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as { email: string }
}

function timeStep(at = Date.now()) {
  return Math.floor(at / 1000 / 30)
}

/** The server accepts each 30-second step once, so a new sign-in needs a later one. */
async function waitForStepAfter(step: number) {
  while (timeStep() <= step) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return timeStep()
}

/** RFC 6238 with the defaults every authenticator app uses: HMAC-SHA1, six digits. */
function totp(key: Buffer, step: number) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hash = createHmac('sha1', key).update(counter).digest()
  const offset = hash[hash.length - 1] & 0x0f
  const binary = hash.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, '0')
}

function base32Decode(text: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (const character of text.replace(/[\s=]/g, '').toUpperCase()) {
    buffer = (buffer << 5) | alphabet.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}
