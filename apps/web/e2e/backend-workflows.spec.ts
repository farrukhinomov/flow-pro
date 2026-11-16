import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test'

const apiBaseUrl =
  process.env.FLOWPRO_E2E_API_BASE_URL ?? 'http://127.0.0.1:5124/api/v1'

const tenantId = '01975fa8-7590-7000-8000-000000000001'
const approverUserId = '01975fa8-7590-7000-8000-000000000002'
const approverExternalId = 'usr-marta-lindgren'
const workerUserId = '01975fa8-7590-7000-8000-000000000010'
const workerEmployeeId = '01975fa8-7590-7000-8000-000000000011'
const workerExternalId = 'usr-hannah-fischer'
const workerName = 'Hannah Fischer'

const developmentAuthHeaders = {
  'X-FlowPro-Tenant-Id': tenantId,
  'X-FlowPro-User-Id': approverUserId,
}

const workerAuthHeaders = {
  'X-FlowPro-Tenant-Id': tenantId,
  'X-FlowPro-User-Id': workerUserId,
}

function commandHeaders(idempotencyKey: string) {
  return {
    ...workerAuthHeaders,
    'Idempotency-Key': idempotencyKey,
  }
}

test.describe('backend-connected Today and Timesheet workflows', () => {
  test.describe.configure({ mode: 'serial' })

  test('persists the repeatable QA scenario across workflow sessions', async ({
    request,
  }) => {
    await expectOkResponse(
      await request.post(`${apiBaseUrl}/development/reset-qa-scenario`, {
        headers: developmentAuthHeaders,
      }),
      'reset repeatable QA scenario'
    )

    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/clock-in`, {
        data: { location: 'office' },
        headers: commandHeaders('qa-clock-in'),
      }),
      200,
      'clock in worker'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/clock-in`, {
        data: { location: 'office' },
        headers: commandHeaders('qa-duplicate-clock-in'),
      }),
      409,
      'block duplicate clock in'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/start-break`, {
        headers: commandHeaders('qa-start-break'),
      }),
      200,
      'start break'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/resume-work`, {
        headers: commandHeaders('qa-resume-work'),
      }),
      200,
      'resume work'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/clock-out`, {
        headers: commandHeaders('qa-clock-out'),
      }),
      200,
      'clock out worker'
    )

    const forbiddenHeaders = {
      'X-FlowPro-Tenant-Id': tenantId,
      'X-FlowPro-User-Id': '01975fa8-7590-7000-8000-00000000ffff',
    }
    await expectStatus(
      request.get(`${apiBaseUrl}/attendance/me/status`, {
        headers: forbiddenHeaders,
      }),
      403,
      'block unauthorized attendance fallback boundary'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/timesheet-workflows/${workerExternalId}/bad/sign`, {
        data: { note: 'Invalid period must not fall back locally.' },
        headers: developmentAuthHeaders,
      }),
      400,
      'block invalid timesheet period fallback boundary'
    )

    const correctionId = `qa-correction-${Date.now()}`
    const absenceId = `qa-absence-${Date.now()}`

    await submitRequest(request, {
      clockIn: '08:00',
      clockOut: '17:00',
      fromDate: '2026-06-16',
      id: correctionId,
      kind: 'booking-correction',
      reason: 'Repeatable QA correction request.',
      statusCode: undefined,
      statusLabel: undefined,
      statusTypeId: undefined,
      subtype: 'Korrektur Arbeitszeit',
      toDate: '2026-06-16',
    })
    await decideRequest(request, correctionId, 'Approve correction from QA.')

    await submitRequest(request, {
      clockIn: undefined,
      clockOut: undefined,
      fromDate: '2026-06-17',
      id: absenceId,
      kind: 'absence',
      reason: 'Repeatable QA absence request.',
      statusCode: 'vacation',
      statusLabel: 'Urlaub',
      statusTypeId: 'status-type-vacation',
      subtype: 'Urlaub',
      toDate: '2026-06-17',
    })
    await decideRequest(request, absenceId, 'Approve absence from QA.')

    const periodMonth = '2026-06'
    const signedApproval = await jsonOk<MonthlyTimesheetApproval>(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/sign`,
        {
          data: {
            note: 'Repeatable QA sign-off.',
            snapshot: {
              rows: [
                {
                  date: '2026-06-16',
                  employeeId: workerExternalId,
                  workedMinutes: 540,
                },
              ],
              totals: {
                balanceMinutes: 60,
                workedMinutes: 540,
              },
            },
          },
          headers: developmentAuthHeaders,
        }
      ),
      'sign monthly timesheet'
    )
    expect(signedApproval.status).toBe('signed')
    expect(signedApproval.signedById).toBe(approverExternalId)
    expect(signedApproval.signedAt).toBeTruthy()

    await expectOkResponse(
      await request.post(`${apiBaseUrl}/payroll/workflows/exports`, {
        data: {
          clientOperationId: `qa-payroll-export-${Date.now()}`,
          format: 'DATEV',
          period: periodMonth,
          scope: workerExternalId,
        },
        headers: developmentAuthHeaders,
      }),
      'create payroll export workflow record'
    )
    await expectOkResponse(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/exports/payroll`,
        { headers: developmentAuthHeaders }
      ),
      'mark payroll export on signed timesheet'
    )
    await expectOkResponse(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/exports/pdf`,
        { headers: developmentAuthHeaders }
      ),
      'mark PDF export on signed timesheet'
    )

    const managerSession = await playwrightRequest.newContext({
      extraHTTPHeaders: developmentAuthHeaders,
    })
    try {
      const persistedCorrection = await findRequest(
        managerSession,
        correctionId
      )
      const persistedAbsence = await findRequest(managerSession, absenceId)
      const persistedTimesheet = await jsonOk<MonthlyTimesheetApproval>(
        await managerSession.get(
          `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}`
        ),
        'reload signed timesheet in a second workflow session'
      )
      const payrollExports = await listAggregates(managerSession, 'payroll/workflows/exports')
      const absenceAggregates = await listAggregates(
        managerSession,
        'absence-workflows/manager'
      )

      expect(persistedCorrection.payload.status).toBe('approved')
      expect(persistedAbsence.payload.status).toBe('approved')
      expect(
        absenceAggregates.some((item) => item.payload.requestId === absenceId)
      ).toBe(true)
      expect(persistedTimesheet.status).toBe('signed')
      expect(persistedTimesheet.payrollExportedAt).toBeTruthy()
      expect(persistedTimesheet.pdfExportedAt).toBeTruthy()
      expect(
        payrollExports.some(
          (item) =>
            item.payload.period === periodMonth &&
            item.payload.scope === workerExternalId
        )
      ).toBe(true)
    } finally {
      await managerSession.dispose()
    }

    const workerSession = await playwrightRequest.newContext({
      extraHTTPHeaders: workerAuthHeaders,
    })
    try {
      const attendanceEvents = await listAttendanceEvents(workerSession)
      expect(attendanceEvents.items.map((item) => item.type)).toEqual([
        'clockIn',
        'startBreak',
        'resumeWork',
        'clockOut',
      ])
    } finally {
      await workerSession.dispose()
    }
  })

  test('shows worker data to a manager after a real UI user switch and reload', async ({
    page,
    request,
  }) => {
    await expectOkResponse(
      await request.post(`${apiBaseUrl}/development/reset-qa-scenario`, {
        headers: developmentAuthHeaders,
      }),
      'reset repeatable UI scenario'
    )

    await signIn(page, 'hannah.fischer@flowpro.local', 'FlowPro!2026')
    await expect(
      page.getByRole('heading', { name: /^(Today|Heute)$/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^(Clock in|Einstempeln)$/i })
    ).toBeVisible()

    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/clock-in`, {
        data: { location: 'office' },
        headers: commandHeaders('qa-ui-worker-clock-in'),
      }),
      200,
      'clock in worker for UI verification'
    )
    await expectStatus(
      request.post(`${apiBaseUrl}/attendance/commands/clock-out`, {
        headers: commandHeaders('qa-ui-worker-clock-out'),
      }),
      200,
      'clock out worker for UI verification'
    )

    // The Timesheet page opens on the current month, so the period signed here
    // must follow the calendar. Hard-coding a month makes this assertion rot the
    // moment the month rolls over.
    const periodMonth = currentPeriodMonth()
    await expectOkResponse(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/sign`,
        {
          data: {
            note: 'UI persistence verification.',
            snapshot: {
              rows: [
                { date: `${periodMonth}-16`, employeeId: workerExternalId },
              ],
              totals: { workedMinutes: 0 },
            },
          },
          headers: developmentAuthHeaders,
        }
      ),
      'sign worker timesheet for UI verification'
    )
    await expectOkResponse(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/exports/payroll`,
        { headers: developmentAuthHeaders }
      ),
      'mark worker payroll export for UI verification'
    )
    await expectOkResponse(
      await request.post(
        `${apiBaseUrl}/timesheet-workflows/${workerExternalId}/${periodMonth}/exports/pdf`,
        { headers: developmentAuthHeaders }
      ),
      'mark worker PDF export for UI verification'
    )

    await clearLocalAuth(page)
    await signIn(page, 'founder@flowpro.local', 'superadmin', '/timesheet')
    await selectTimesheetEmployee(page, 'Fischer, Hannah', 'Hannah Fischer')

    await expect(page.getByText(/^(Signed and locked|Signiert und gesperrt)$/i)).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /^(Timesheet|Zeiterfassung)$/i })
    ).toBeVisible()
    await selectTimesheetEmployee(page, 'Fischer, Hannah', 'Hannah Fischer')
    await expect(page.getByText(/^(Signed and locked|Signiert und gesperrt)$/i)).toBeVisible()
    await expect(page.getByText(/Hannah Fischer/)).toBeVisible()
  })
})

/**
 * Regression guard for offline attendance capture.
 *
 * Offline clock events are queued in the browser outbox as `clock-event.create`
 * operations. They must be replayed through the authoritative
 * /attendance/commands/* endpoint, because the generic /sync/batches channel
 * deliberately rejects `clock-event` writes (see
 * SyncCommandHandlerTests.RejectsGenericClockEventWritesBecauseAttendanceApiIsAuthoritative).
 *
 * Before the routing fix this test fails: the queued booking is rejected as
 * non-retryable, never reaches PostgreSQL, and the worker silently loses a
 * clock-in — which is payroll and legal evidence.
 */
test.describe('offline attendance replay', () => {
  test.describe.configure({ mode: 'serial' })

  // This is the only scenario that deliberately leaves the worker mid-shift, so
  // it restores the shared seeded tenant for whatever runs next.
  test.afterAll(async () => {
    const session = await playwrightRequest.newContext({
      extraHTTPHeaders: developmentAuthHeaders,
    })

    try {
      await session.post(`${apiBaseUrl}/development/reset-qa-scenario`)
    } finally {
      await session.dispose()
    }
  })

  test('replays an offline clock-in to the server once connectivity returns', async ({
    page,
    request,
  }) => {
    await expectOkResponse(
      await request.post(`${apiBaseUrl}/development/reset-qa-scenario`, {
        headers: developmentAuthHeaders,
      }),
      'reset QA scenario for offline replay'
    )

    const clockInsBefore = await withWorkerSession(countServerClockIns)

    await signIn(page, 'hannah.fischer@flowpro.local', 'FlowPro!2026')
    await expect(
      page.getByRole('heading', { name: /^(Today|Heute)$/i })
    ).toBeVisible()

    const clockInButton = page.getByRole('button', {
      name: /^(Clock in|Einstempeln)$/i,
    })
    await expect(clockInButton).toBeVisible()

    // Drop connectivity so the attendance command fails and the gateway falls
    // back to the local outbox instead of reaching the server.
    await page.context().setOffline(true)
    await clockInButton.click()

    // The optimistic local write must still move the worker into "working",
    // otherwise the offline capture itself is broken and the replay is moot.
    await expect(
      page.getByRole('button', { name: /^(Clock out|Ausstempeln)$/i })
    ).toBeVisible()

    // Restore connectivity. The sync engine drains the outbox on the browser
    // "online" event and on its polling interval.
    await page.context().setOffline(false)

    // The booking has to land in PostgreSQL, not just in the browser cache.
    await expect
      .poll(() => withWorkerSession(countServerClockIns), {
        message:
          'the offline clock-in must be replayed through the attendance API and persisted',
        timeout: 45_000,
      })
      .toBeGreaterThan(clockInsBefore)
  })
})

/**
 * Runs a read against the API as the worker, always disposing the context.
 */
async function withWorkerSession<T>(
  action: (session: APIRequestContext) => Promise<T>
): Promise<T> {
  const session = await playwrightRequest.newContext({
    extraHTTPHeaders: workerAuthHeaders,
  })

  try {
    return await action(session)
  } finally {
    await session.dispose()
  }
}

async function countServerClockIns(session: APIRequestContext) {
  const events = await listAttendanceEvents(session)

  return events.items.filter((item) => item.type === 'clockIn').length
}

type MonthlyTimesheetApproval = {
  employeeId: string
  id: string
  payrollExportedAt?: string | null
  pdfExportedAt?: string | null
  periodMonth: string
  signedAt?: string | null
  signedById?: string | null
  status: string
}

type RequestSubmission = {
  clockIn?: string
  clockOut?: string
  fromDate: string
  id: string
  kind: 'absence' | 'booking-correction'
  reason: string
  statusCode?: string
  statusLabel?: string
  statusTypeId?: string
  subtype: string
  toDate: string
}

type AggregateItem<TPayload extends Record<string, unknown>> = {
  aggregateId: string
  payload: TPayload
}

async function submitRequest(
  request: APIRequestContext,
  submission: RequestSubmission
) {
  await expectOkResponse(
    await request.post(`${apiBaseUrl}/request-workflows`, {
      data: {
        approvalFlow: {
          autoApproved: false,
          currentStepIndex: 0,
          steps: [
            {
              approverIds: [approverUserId],
              approverNames: ['Marta Lindgren'],
              decisions: [],
              id: 'manager-approval',
              label: 'Manager approval',
              requireAll: false,
              status: 'pending',
            },
          ],
        },
        attachments: [],
        clockIn: submission.clockIn,
        clockOut: submission.clockOut,
        employeeId: workerEmployeeId,
        employeeName: workerName,
        fromDate: submission.fromDate,
        kind: submission.kind,
        reason: submission.reason,
        requestId: submission.id,
        statusCode: submission.statusCode,
        statusLabel: submission.statusLabel,
        statusTypeId: submission.statusTypeId,
        subtype: submission.subtype,
        toDate: submission.toDate,
      },
      headers: workerAuthHeaders,
    }),
    `submit ${submission.kind} request`
  )
}

async function decideRequest(
  request: APIRequestContext,
  requestId: string,
  comment: string
) {
  await expectOkResponse(
    await request.post(
      `${apiBaseUrl}/request-workflows/${encodeURIComponent(requestId)}/decision`,
      {
        data: { comment, decision: 'approve' },
        headers: developmentAuthHeaders,
      }
    ),
    `approve request ${requestId}`
  )
}

async function findRequest(
  request: APIRequestContext,
  requestId: string
): Promise<AggregateItem<{ status: string }>> {
  const requests = await listAggregates<{ status: string }>(
    request,
    'request-workflows/approval-inbox'
  )
  const found = requests.find((item) => item.aggregateId === requestId)
  expect(found).toBeTruthy()
  return found as AggregateItem<{ status: string }>
}

async function listAggregates<TPayload extends Record<string, unknown>>(
  request: APIRequestContext,
  resource: string
) {
  const response = await jsonOk<{ items: AggregateItem<TPayload>[] }>(
    await request.get(`${apiBaseUrl}/${resource}`),
    `list ${resource}`
  )
  return response.items
}

async function listAttendanceEvents(request: APIRequestContext) {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)

  return jsonOk<{ items: { type: string }[] }>(
    await request.get(
      `${apiBaseUrl}/attendance/me/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
    ),
    'list attendance events after reload'
  )
}

/**
 * The period the Timesheet page opens on: the current calendar month in local
 * time, mirroring formatPeriodMonth(getCurrentMonthDate()) in the app.
 */
function currentPeriodMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  redirectTo = '/'
) {
  await page.goto(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`)
  await page.getByLabel(/^(Email|E-Mail)$/i).fill(email)
  await page
    .getByRole('textbox', { name: /^(Password|Passwort)$/i })
    .fill(password)
  await page
    .getByRole('button', { name: /^(Sign in|Anmelden)$/i })
    .click()
}

async function clearLocalAuth(page: Page) {
  await page.context().clearCookies()
  await page.evaluate(() => {
    window.sessionStorage.clear()
    window.localStorage.removeItem('flowpro.last-requested-viewer')
  })
}

async function selectTimesheetEmployee(
  page: Page,
  employeeLabel: string,
  employeeDisplayName: string
) {
  const personSelect = page.getByLabel(/^(Person|Person)$/i)
  await personSelect.click()
  await page.getByRole('option', { name: employeeLabel }).click()
  await expect(page.getByText(employeeDisplayName)).toBeVisible()
}

async function expectStatus(
  responsePromise: Promise<APIResponse>,
  status: number,
  action: string
) {
  const response = await responsePromise
  if (response.status() === status) return

  throw new Error(
    `Expected HTTP ${status} to ${action}, received ${response.status()} ${await response.text()}`
  )
}

async function jsonOk<T>(response: APIResponse, action: string): Promise<T> {
  await expectOkResponse(response, action)
  return response.json() as Promise<T>
}

async function expectOkResponse(response: APIResponse, action: string) {
  if (response.ok()) return

  throw new Error(
    `Failed to ${action}: HTTP ${response.status()} ${await response.text()}`
  )
}
