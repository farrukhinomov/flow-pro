import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'

/**
 * The public demo: shared one-click logins, locked sign-in settings, and the nightly reset. Run with
 * `npm run test:e2e:demo`, which schedules the reset a minute or two ahead.
 */

const password = process.env.FLOWPRO_E2E_DEMO_PASSWORD ?? ''
const manager = 'sam.rivera@demo.invalid'

test.describe('public demo', () => {
  test.describe.configure({ mode: 'serial' })

  test('a visitor signs in with one click and finds the shared login locked', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await expect(page.getByText('Try the demo', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create workspace' })).toHaveCount(0)

    await page.getByRole('button', { name: /Sign in as Manager/ }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)
    const session = await currentSession(page.request)
    expect(session.email).toBe(manager)
    expect(session.tenantName).toBe('FlowPro Demo')

    await page.goto('/settings/security')
    await expect(
      page.getByText(/This is a shared demo login/, { exact: false })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Change password' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Two-step sign-in' })
    ).toHaveCount(0)

    // The server refuses on its own too.
    const change = await page.request.post('/api/v1/auth/password/change', {
      data: { currentPassword: password, newPassword: 'a visitor password' },
    })
    expect(change.status()).toBe(403)
    expect(((await change.json()) as { code: string }).code).toBe(
      'account.shared_demo_account'
    )
  })

  test('wrong passwords do not lock a shared login for everyone else', async ({
    baseURL,
  }) => {
    const visitor = await playwrightRequest.newContext({ baseURL })
    try {
      for (let attempt = 0; attempt < 7; attempt++) {
        const wrong = await visitor.post('/api/v1/auth/sign-in', {
          data: { email: manager, password: 'not the demo password' },
        })
        expect(wrong.status()).toBe(401)
      }

      const right = await visitor.post('/api/v1/auth/sign-in', {
        data: { email: manager, password },
      })
      expect(right.status(), await right.text()).toBe(200)
    } finally {
      await visitor.dispose()
    }
  })

  test('nobody can register', async ({ baseURL }) => {
    const visitor = await playwrightRequest.newContext({ baseURL })
    try {
      const response = await visitor.post('/api/v1/auth/register', {
        data: {
          email: 'visitor@example.com',
          password: 'a visitor password',
          displayName: 'Visitor',
        },
      })
      expect(response.status()).toBe(403)
    } finally {
      await visitor.dispose()
    }
  })

  test('the sample requests reach the manager but not other employees', async ({
    baseURL,
  }) => {
    const pendingFor = async (email: string) => {
      const visitor = await playwrightRequest.newContext({ baseURL })
      try {
        const signedIn = await visitor.post('/api/v1/auth/sign-in', {
          data: { email, password },
        })
        expect(signedIn.status(), await signedIn.text()).toBe(200)
        const changes = await visitor.get('/api/v1/sync/changes?limit=200')
        expect(changes.status(), await changes.text()).toBe(200)
        const page = (await changes.json()) as {
          items: {
            aggregateType: string
            payload: {
              payload: { employeeName: string; status: string }
            }
          }[]
        }
        return page.items
          .filter((change) => change.aggregateType === 'request')
          .map((change) => change.payload.payload)
      } finally {
        await visitor.dispose()
      }
    }

    const managerSees = await pendingFor(manager)
    expect(managerSees).toContainEqual(
      expect.objectContaining({ employeeName: 'Jamie Chen', status: 'submitted' })
    )
    expect(new Set(managerSees.map((request) => request.status))).toEqual(
      new Set(['submitted', 'approved', 'rejected'])
    )

    // An employee sees only their own request.
    const employeeSees = await pendingFor('jamie.chen@demo.invalid')
    expect(employeeSees.map((request) => request.employeeName)).toEqual([
      'Jamie Chen',
    ])
  })

  test('the nightly reset wipes everything and seeds the demo again', async ({
    baseURL,
  }) => {
    test.setTimeout(240_000)
    const visitor = await playwrightRequest.newContext({ baseURL })
    try {
      const signedIn = await visitor.post('/api/v1/auth/sign-in', {
        data: { email: manager, password },
      })
      expect(signedIn.status()).toBe(200)

      // The reset truncates every table, sessions included.
      await expect
        .poll(
          async () => (await visitor.get('/api/v1/auth/session')).status(),
          { intervals: [5_000], timeout: 200_000 }
        )
        .toBe(401)

      const again = await visitor.post('/api/v1/auth/sign-in', {
        data: { email: manager, password },
      })
      expect(again.status(), await again.text()).toBe(200)
      expect((await currentSession(visitor)).tenantName).toBe('FlowPro Demo')
    } finally {
      await visitor.dispose()
    }
  })
})

async function currentSession(context: APIRequestContext) {
  const response = await context.get('/api/v1/auth/session')
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as { email: string; tenantName: string }
}
