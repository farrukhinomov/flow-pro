import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

/**
 * Invitations by email and switching between workspaces, on the real session path. Run with
 * `npm run test:e2e:session`.
 */

const mailpitUrl =
  process.env.FLOWPRO_E2E_MAILPIT_URL ?? 'http://127.0.0.1:8025'
const founder = { email: 'founder@flowpro.local', password: 'superadmin' }
const seededWorkspace = 'FlowPro Demo'
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = 'invited e2e passphrase'

test.describe('invitations', () => {
  test.describe.configure({ mode: 'serial' })

  test('a new person joins with a new account from the emailed link', async ({
    page,
    baseURL,
  }) => {
    const email = `e2e-invitee-${runId}@flowpro.test`
    const userId = await inviteAsFounder(baseURL, email)
    const firstLink = await waitForEmailLink(email, 'You are invited to')

    // Sending the invitation again ends the first link.
    await resendAsFounder(baseURL, userId)
    const link = await waitForEmailLink(email, 'You are invited to', firstLink)
    await page.goto(firstLink)
    await expect(
      page.getByText('This invitation does not work', { exact: true })
    ).toBeVisible()

    await page.goto(link)
    await expect(
      page.getByText(`Join ${seededWorkspace}`, { exact: true })
    ).toBeVisible()
    await expect(page).not.toHaveURL(/token=/)

    await page.getByLabel('Your name').fill('Invited Person')
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account and join' }).click()

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    const session = await currentSession(page.request)
    expect(session.tenantName).toBe(seededWorkspace)
    expect(session.email).toBe(email)

    // The link works once.
    await page.goto(link)
    await expect(
      page.getByText('This invitation does not work', { exact: true })
    ).toBeVisible()
  })

  test('someone with an account joins a second workspace and switches between them', async ({
    page,
    baseURL,
  }) => {
    const email = `e2e-member-${runId}@flowpro.test`
    const ownWorkspace = `Own e2e ${runId}`
    await registerWithWorkspace(baseURL, email, ownWorkspace)
    await inviteAsFounder(baseURL, email)
    const link = await waitForEmailLink(email, 'You are invited to')

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password' }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)
    expect((await currentSession(page.request)).tenantName).toBe(ownWorkspace)

    await page.goto(link)
    await page.getByRole('button', { name: 'Join the workspace' }).click()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    expect((await currentSession(page.request)).tenantName).toBe(
      seededWorkspace
    )

    await openUserMenu(page, email)
    await expect(page.getByText('Workspaces', { exact: true })).toBeVisible()
    await page.getByRole('menuitem', { name: ownWorkspace }).click()
    await expect
      .poll(async () => (await currentSession(page.request)).tenantName)
      .toBe(ownWorkspace)

    // A new sign-in starts where the person worked last.
    const fresh = await playwrightRequest.newContext({ baseURL })
    try {
      await signIn(fresh, email, password)
      expect((await currentSession(fresh)).tenantName).toBe(ownWorkspace)
    } finally {
      await fresh.dispose()
    }
  })
})

/** Invites `email` into the seeded workspace and returns the new member's id. */
async function inviteAsFounder(baseURL: string | undefined, email: string) {
  const founderSession = await playwrightRequest.newContext({ baseURL })
  try {
    await signIn(founderSession, founder.email, founder.password)
    const response = await founderSession.post(
      '/api/v1/directory/users/invitations',
      { data: { email, role: 'employee' } }
    )
    expect(response.status(), await response.text()).toBe(200)
    return ((await response.json()) as { user: { id: string } }).user.id
  } finally {
    await founderSession.dispose()
  }
}

async function resendAsFounder(baseURL: string | undefined, userId: string) {
  const founderSession = await playwrightRequest.newContext({ baseURL })
  try {
    await signIn(founderSession, founder.email, founder.password)
    const response = await founderSession.post(
      `/api/v1/directory/users/${encodeURIComponent(userId)}/invitation`
    )
    expect(response.status(), await response.text()).toBe(200)
  } finally {
    await founderSession.dispose()
  }
}

async function registerWithWorkspace(
  baseURL: string | undefined,
  email: string,
  workspaceName: string
) {
  const owner = await playwrightRequest.newContext({ baseURL })
  try {
    const registered = await owner.post('/api/v1/auth/register', {
      data: { email, password, displayName: 'Member Person' },
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

async function signIn(context: APIRequestContext, email: string, pass: string) {
  const response = await context.post('/api/v1/auth/sign-in', {
    data: { email, password: pass },
  })
  expect(response.status(), await response.text()).toBe(200)
}

async function currentSession(context: APIRequestContext) {
  const response = await context.get('/api/v1/auth/session')
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as { tenantName: string; email: string }
}

async function openUserMenu(page: Page, email: string) {
  await page
    .getByRole('button', { name: new RegExp(escapeRegExp(email)) })
    .first()
    .click()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type MailpitSearch = { messages: { ID: string }[] }

/**
 * Waits for the newest email whose subject contains `subject` and returns its link, optionally
 * one that differs from a link already seen.
 */
async function waitForEmailLink(to: string, subject: string, notLink?: string) {
  const mailpit = await playwrightRequest.newContext({ baseURL: mailpitUrl })

  try {
    let link: string | undefined

    await expect
      .poll(
        async () => {
          const search = await mailpit.get('/api/v1/search', {
            params: { query: `to:"${to}" subject:"${subject}"` },
          })
          if (!search.ok()) return undefined

          const { messages } = (await search.json()) as MailpitSearch
          if (!messages[0]) return undefined

          const message = await mailpit.get(`/api/v1/message/${messages[0].ID}`)
          const { Text } = (await message.json()) as { Text: string }
          link = Text.match(/https?:\/\/\S+#token=[\w-]+/)?.[0]
          return link === notLink ? undefined : link
        },
        { message: `email "${subject}" to ${to}`, timeout: 20_000 }
      )
      .toBeDefined()

    return link as string
  } finally {
    await mailpit.dispose()
  }
}
