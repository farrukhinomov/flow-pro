import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test'

/**
 * The public demo: shared one-click logins, locked sign-in settings, and the nightly reset. Run with
 * `npm run test:e2e:demo`, which schedules the reset two to three minutes ahead.
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

  test('the manager finds their team’s requests waiting for approval', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: /Sign in as Manager/ }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)

    await page.goto('/requests')
    await page.getByRole('tab', { name: 'Approvals' }).click()
    const queue = page.getByRole('tabpanel', { name: 'Approvals' })
    await expect(queue.getByText('Jamie Chen').first()).toBeVisible()
    await expect(queue.getByText('Lukas Becker').first()).toBeVisible()
    // Product is led by the admin, so its requests are not this manager's to decide.
    await expect(queue.getByText('Sofia Rossi')).toHaveCount(0)
  })

  test('an employee can plan an absence and sees their own timesheet', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: /Sign in as Employee/ }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)

    await page.goto('/requests')
    await page.getByRole('combobox', { name: 'Absence type' }).click()
    await expect(page.getByRole('option', { name: /Vacation/ })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.goto('/timesheet')
    await expect(page.getByText(/Jamie Chen/).first()).toBeVisible()
    await expect(page.getByText(/Unknown employee/)).toHaveCount(0)
  })

  test('an employee who opens the People page sees only themselves', async ({
    browser,
  }) => {
    const employee = await signedInAs(browser, 'Employee')
    await employee.goto('/users')
    await expect(employee.getByText('Jamie Chen').first()).toBeVisible()
    await expect(employee.getByText('Priya Nair')).toHaveCount(0)
    await employee.context().close()
  })

  test('the manager approves a vacation and the employee sees it approved', async ({
    browser,
  }) => {
    const manager = await signedInAs(browser, 'Manager')
    await manager.goto('/requests')
    await manager.getByRole('tab', { name: 'Approvals' }).click()
    const queue = manager.getByRole('tabpanel', { name: 'Approvals' })
    const jamie = queue.getByRole('row').filter({ hasText: 'Jamie Chen' })
    await jamie.getByRole('button', { name: 'Review' }).click()
    await manager.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(jamie).toHaveCount(0)
    await manager.context().close()

    const employee = await signedInAs(browser, 'Employee')
    await employee.goto('/requests')
    await employee.getByRole('tab', { name: 'Mine' }).click()
    await expect(
      employee
        .getByRole('tabpanel', { name: 'Mine' })
        .getByRole('row')
        .filter({ hasText: 'Vacation' })
        .getByText('Approved')
    ).toBeVisible()
    await employee.context().close()
  })

  test('an employee clocks in and out and the day shows on their timesheet', async ({
    browser,
  }) => {
    const employee = await signedInAs(browser, 'Employee')
    await employee.goto('/')
    await employee.getByRole('button', { name: 'Clock in', exact: true }).click()
    await expect(
      employee.getByRole('button', { name: 'Clock out', exact: true })
    ).toBeVisible()
    await employee.getByRole('button', { name: 'Clock out', exact: true }).click()
    await expect(employee.getByText('Finished', { exact: true })).toBeVisible()

    // The ledger shows the day with its clock-in, and no longer as open.
    await employee.goto('/timesheet')
    const ledger = employee.getByText(/Today\s*Clock-in \d{2}:\d{2}/)
    await expect(ledger).toBeVisible()
    await expect(
      employee.getByText(/Today\s*Clock-in \d{2}:\d{2}.*\bopen\b/)
    ).toHaveCount(0)
    await employee.context().close()
  })

  test('an employee’s request reaches their manager', async ({ browser }) => {
    const employee = await signedInAs(browser, 'Employee')
    await employee.goto('/requests')
    await employee.getByRole('combobox', { name: 'Absence type' }).click()
    await employee.getByRole('option', { name: /Home office/ }).click()
    await employee.getByRole('button', { name: 'Submit request' }).click()
    await expect(employee.getByText('Request submitted.')).toBeVisible()
    await employee.context().close()

    const manager = await signedInAs(browser, 'Manager')
    await manager.goto('/requests')
    await manager.getByRole('tab', { name: 'Approvals' }).click()
    await expect(
      manager
        .getByRole('tabpanel', { name: 'Approvals' })
        .getByRole('row')
        .filter({ hasText: 'Jamie Chen' })
        .filter({ hasText: 'Home office' })
    ).toBeVisible()
    await manager.context().close()
  })

  test('the nightly reset wipes everything and seeds the demo again', async ({
    baseURL,
  }) => {
    test.setTimeout(300_000)
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
          { intervals: [5_000], timeout: 260_000 }
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

/** Signs in with a demo login's one-click button, in a browser context of its own. */
async function signedInAs(
  browser: Browser,
  role: 'Admin' | 'Manager' | 'Employee'
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'en-US',
  })
  const page = await context.newPage()
  await page.goto('/sign-in')
  await page
    .getByRole('button', { name: new RegExp(`Sign in as ${role}`) })
    .click()
  await expect(page).not.toHaveURL(/\/sign-in/)
  return page
}
