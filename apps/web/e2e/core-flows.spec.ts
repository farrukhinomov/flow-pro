import { expect, test, type APIResponse, type Page } from '@playwright/test'

const apiBaseUrl =
  process.env.FLOWPRO_E2E_API_BASE_URL ?? 'http://127.0.0.1:5124/api/v1'
const developmentAuthHeaders = {
  'X-FlowPro-Tenant-Id': '01975fa8-7590-7000-8000-000000000001',
  'X-FlowPro-User-Id': '01975fa8-7590-7000-8000-000000000002',
}

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

test.describe('core FlowPro UI smoke flows', () => {
  test.describe.configure({ mode: 'serial' })

  test('persists the main clock flow and booking corrections in the backend', async ({
    page,
    request,
  }) => {
    const resetResponse = await request.post(
      `${apiBaseUrl}/development/reset-attendance`,
      { headers: developmentAuthHeaders }
    )
    await expectOkResponse(resetResponse, 'reset development attendance')

    await signInAsSuperadmin(page)

    await page
      .getByRole('button', { name: /^(Clock in|Einstempeln)$/i })
      .click()
    await expect(
      page.getByRole('button', { name: /^(Clock out|Ausstempeln)$/i })
    ).toBeVisible()

    await page
      .getByRole('button', { name: /^(Start break|Pause starten)$/i })
      .click()
    await expect(
      page.getByRole('button', { name: /^(Resume work|Arbeit fortsetzen)$/i })
    ).toBeVisible()

    await page
      .getByRole('button', { name: /^(Resume work|Arbeit fortsetzen)$/i })
      .click()
    await expect(
      page.getByRole('button', { name: /^(Clock out|Ausstempeln)$/i })
    ).toBeVisible()

    await page
      .getByRole('button', { name: /^(Clock out|Ausstempeln)$/i })
      .click()
    await expect(
      page.getByRole('button', { name: /^(Clock in again|Erneut einstempeln)$/i })
    ).toBeVisible()

    await page
      .getByRole('button', { name: /^(Manage bookings|Buchungen verwalten)$/i })
      .first()
      .click()
    const firstSyncedBooking = page
      .getByRole('group', { name: /\bsynced\b/i })
      .first()
    const firstTimeInput = firstSyncedBooking
      .locator('input[type="datetime-local"]')
      .first()
    const firstTime = await firstTimeInput.inputValue()
    await firstTimeInput.fill(shiftLocalDateTime(firstTime, -1))
    await firstSyncedBooking
      .locator('textarea')
      .first()
      .fill('Corrected by the integrated UI test.')
    await firstSyncedBooking
      .getByRole('button', { name: /^(Save event|Ereignis speichern)$/i })
      .click()
    await expect(
      page.getByText(/^(Clock event updated\.|Zeitereignis aktualisiert\.)$/i)
    ).toBeVisible()

    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const eventsResponse = await request.get(
      `${apiBaseUrl}/attendance/me/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { headers: developmentAuthHeaders }
    )
    await expectOkResponse(eventsResponse, 'list backend attendance events')
    expect((await eventsResponse.json()).items).toHaveLength(4)
  })

  test('submits an absence request from the request workspace', async ({
    page,
  }) => {
    await signInAsSuperadmin(page)
    await page.goto('/requests')

    await expect(
      page.getByRole('heading', { name: /^(Requests|Anträge)$/i })
    ).toBeVisible()
    await page.locator('#from-date').fill('2026-06-02')
    await page.locator('#to-date').fill('2026-06-02')
    await page
      .locator('#request-remark')
      .fill('UI smoke test request from the local-first workflow.')
    await page
      .getByRole('button', { name: /^(Submit request|Antrag einreichen)$/i })
      .click()

    await expect(
      page.getByText(/^(Request submitted\.|Antrag eingereicht\.)$/i)
    ).toBeVisible()
  })

  test('opens timesheet and reports payroll surfaces for an admin', async ({
    page,
  }) => {
    await signInAsSuperadmin(page)

    await page.goto('/timesheet')
    await expect(
      page.getByRole('heading', { name: /^(Timesheet|Zeiterfassung)$/i })
    ).toBeVisible()
    await page
      .getByRole('button', { name: /^(Export|Exportieren)$/i })
      .click()
    await expect(
      page.getByRole('menuitem', { name: /^(Payroll CSV|Payroll-CSV)$/i })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /^(Export PDF|PDF exportieren)$/i })
    ).toBeVisible()

    await page.goto('/reports')
    await expect(
      page.getByRole('heading', {
        name: /^(Reports (&|and) payroll|Berichte & Payroll)$/i,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^(Payroll CSV|Payroll-CSV)$/i })
    ).toBeVisible()
  })
})

function shiftLocalDateTime(value: string, minutes: number) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() + minutes)

  const pad = (part: number) => String(part).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function expectOkResponse(
  response: APIResponse,
  action: string
) {
  if (response.ok()) return

  throw new Error(
    `Failed to ${action}: HTTP ${response.status()} ${await response.text()}`
  )
}
