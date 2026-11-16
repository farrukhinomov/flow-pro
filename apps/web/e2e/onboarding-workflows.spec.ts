import { expect, test, type APIResponse } from '@playwright/test'

const apiBaseUrl =
  process.env.FLOWPRO_E2E_API_BASE_URL ?? 'http://127.0.0.1:5124/api/v1'

const seededTenantId = '01975fa8-7590-7000-8000-000000000001'
const seededUserId = '01975fa8-7590-7000-8000-000000000002'

const seededMemberHeaders = {
  'X-FlowPro-Tenant-Id': seededTenantId,
  'X-FlowPro-User-Id': seededUserId,
}

/**
 * `X-FlowPro-Subject` makes the development authentication handler issue a principal with a subject
 * and no tenant, which is the state a newly registered account is in. It exercises provisioning
 * without going through registration first.
 */
function newAccountHeaders(subject: string) {
  return {
    'X-FlowPro-Email': `${subject}@flowpro.test`,
    'X-FlowPro-Name': 'Test Founder',
    'X-FlowPro-Subject': subject,
  }
}

function uniqueSubject(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

test.describe('self-serve onboarding workflows', () => {
  test.describe.configure({ mode: 'serial' })

  test('provisions a workspace and drives the setup wizard to completion', async ({
    request,
  }) => {
    const subject = uniqueSubject('claim')
    const headers = newAccountHeaders(subject)

    // An account with no workspace is authenticated but has no resolvable tenant.
    const sessionResponse = await request.get(`${apiBaseUrl}/auth/session`, {
      headers,
    })
    expect(sessionResponse.status()).toBe(401)

    const claimStateResponse = await request.get(
      `${apiBaseUrl}/onboarding/workspace`,
      { headers }
    )
    await expectOkResponse(claimStateResponse, 'read workspace claim state')

    const claimState = await claimStateResponse.json()
    expect(claimState.hasWorkspace).toBe(false)
    expect(claimState.email).toBe(`${subject}@flowpro.test`)
    expect(claimState.suggestedWorkspaceName).toBeTruthy()
    expect(claimState.suggestedSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)

    const claimResponse = await request.post(
      `${apiBaseUrl}/onboarding/workspace`,
      { data: { workspaceName: 'E2E Test GmbH' }, headers }
    )
    await expectOkResponse(claimResponse, 'claim workspace')

    const claim = await claimResponse.json()
    expect(claim.tenantId).toBeTruthy()
    expect(claim.tenantName).toBe('E2E Test GmbH')
    expect(claim.tenantSlug).toMatch(/^e2e-test-gmbh(-\d+)?$/)
    expect(claim.onboarding.status).toBe('in-progress')
    expect(claim.onboarding.currentStep).toBe('company')

    // Provisioning makes the same token resolvable, without re-authenticating.
    const resolvedSessionResponse = await request.get(
      `${apiBaseUrl}/auth/session`,
      { headers }
    )
    await expectOkResponse(resolvedSessionResponse, 'read provisioned session')

    const session = await resolvedSessionResponse.json()
    expect(session.tenantId).toBe(claim.tenantId)
    expect(session.tenantName).toBe('E2E Test GmbH')
    expect(session.roles).toContain('superadmin')
    expect(session.permissions).toContain('organization.manage')
    expect(session.permissions).toContain('attendance.clock.self')

    const companyResponse = await request.put(
      `${apiBaseUrl}/onboarding/steps/company`,
      {
        data: {
          companyName: 'E2E Saarland GmbH',
          countryCode: 'DE',
          regionCode: 'DE-SL',
          timeZoneId: 'Europe/Berlin',
          weeklyHours: 38.5,
        },
        headers,
      }
    )
    await expectOkResponse(companyResponse, 'save company step')

    const company = await companyResponse.json()
    expect(company.companyName).toBe('E2E Saarland GmbH')
    expect(company.countryCode).toBe('DE')
    expect(company.regionCode).toBe('DE-SL')
    expect(company.weeklyHours).toBeCloseTo(38.5, 2)
    expect(company.onboarding.currentStep).toBe('team')

    const skipTeamResponse = await request.post(
      `${apiBaseUrl}/onboarding/steps/team/resolve`,
      { data: { skipped: true }, headers }
    )
    await expectOkResponse(skipTeamResponse, 'skip team step')

    const afterSkip = await skipTeamResponse.json()
    const teamStep = afterSkip.steps.find(
      (step: { step: string }) => step.step === 'team'
    )
    expect(teamStep.resolved).toBe(true)
    expect(teamStep.skipped).toBe(true)
    expect(afterSkip.currentStep).toBe('absences')

    const completeResponse = await request.post(
      `${apiBaseUrl}/onboarding/complete`,
      { headers }
    )
    await expectOkResponse(completeResponse, 'complete onboarding')

    const completed = await completeResponse.json()
    expect(completed.status).toBe('completed')
    expect(completed.currentStep).toBeNull()
    expect(completed.completedAt).toBeTruthy()
    // Steps the user never reached are recorded as skipped, not silently done.
    expect(
      completed.steps.every((step: { resolved: boolean }) => step.resolved)
    ).toBe(true)

    // Setup is a one-way door.
    const secondCompleteResponse = await request.post(
      `${apiBaseUrl}/onboarding/complete`,
      { headers }
    )
    expect(secondCompleteResponse.status()).toBe(409)
    expect((await secondCompleteResponse.json()).code).toBe(
      'onboarding.already_completed'
    )
  })

  test('refuses a second workspace for an account that already has one', async ({
    request,
  }) => {
    const headers = newAccountHeaders(uniqueSubject('duplicate'))

    await expectOkResponse(
      await request.post(`${apiBaseUrl}/onboarding/workspace`, {
        data: { workspaceName: 'Duplicate Test GmbH' },
        headers,
      }),
      'claim first workspace'
    )

    const secondClaim = await request.post(
      `${apiBaseUrl}/onboarding/workspace`,
      { data: { workspaceName: 'Duplicate Test Two GmbH' }, headers }
    )

    expect(secondClaim.status()).toBe(409)
    expect((await secondClaim.json()).code).toBe(
      'onboarding.workspace_already_claimed'
    )
  })

  test('derives a unique slug when the workspace name is taken', async ({
    request,
  }) => {
    const name = `Slug Clash ${Date.now()}`
    const first = await request.post(`${apiBaseUrl}/onboarding/workspace`, {
      data: { workspaceName: name },
      headers: newAccountHeaders(uniqueSubject('slug-a')),
    })
    await expectOkResponse(first, 'claim first slug')

    const second = await request.post(`${apiBaseUrl}/onboarding/workspace`, {
      data: { workspaceName: name },
      headers: newAccountHeaders(uniqueSubject('slug-b')),
    })
    await expectOkResponse(second, 'claim clashing slug')

    const firstSlug = (await first.json()).tenantSlug
    const secondSlug = (await second.json()).tenantSlug

    expect(secondSlug).not.toBe(firstSlug)
    expect(secondSlug.startsWith(firstSlug)).toBe(true)
  })

  test('rejects setup values the working time rules do not allow', async ({
    request,
  }) => {
    const headers = newAccountHeaders(uniqueSubject('validation'))

    await expectOkResponse(
      await request.post(`${apiBaseUrl}/onboarding/workspace`, {
        data: { workspaceName: 'Validation Test GmbH' },
        headers,
      }),
      'claim workspace for validation'
    )

    // The Arbeitszeitgesetz ceiling is 60 hours.
    const tooManyHours = await request.put(
      `${apiBaseUrl}/onboarding/steps/company`,
      {
        data: {
          companyName: 'Validation Test GmbH',
          countryCode: 'DE',
          timeZoneId: 'Europe/Berlin',
          weeklyHours: 80,
        },
        headers,
      }
    )
    expect(tooManyHours.status()).toBe(400)
    expect((await tooManyHours.json()).code).toBe(
      'onboarding.weekly_hours_invalid'
    )

    const badTimeZone = await request.put(
      `${apiBaseUrl}/onboarding/steps/company`,
      {
        data: {
          companyName: 'Validation Test GmbH',
          countryCode: 'DE',
          timeZoneId: 'Mars/Olympus',
          weeklyHours: 40,
        },
        headers,
      }
    )
    expect(badTimeZone.status()).toBe(400)
    expect((await badTimeZone.json()).code).toBe('onboarding.time_zone_invalid')

    const unknownStep = await request.post(
      `${apiBaseUrl}/onboarding/steps/billing/resolve`,
      { data: {}, headers }
    )
    expect(unknownStep.status()).toBe(400)
    expect((await unknownStep.json()).code).toBe('onboarding.step_unknown')
  })

  test('rejects workspace names that are too short', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/onboarding/workspace`, {
      data: { workspaceName: 'A' },
      headers: newAccountHeaders(uniqueSubject('short-name')),
    })

    expect(response.status()).toBe(400)
    expect((await response.json()).code).toBe(
      'onboarding.workspace_name_required'
    )
  })

  test('treats workspaces created before the wizard existed as already set up', async ({
    request,
  }) => {
    const response = await request.get(`${apiBaseUrl}/onboarding/state`, {
      headers: seededMemberHeaders,
    })
    await expectOkResponse(response, 'read seeded tenant onboarding state')

    const state = await response.json()

    // The seeded development tenant predates onboarding and must not be trapped in the wizard.
    expect(state.status).toBe('completed')
    expect(state.currentStep).toBeNull()
  })

  test('requires authentication for every onboarding route', async ({
    request,
  }) => {
    for (const path of ['/onboarding/workspace', '/onboarding/state']) {
      const response = await request.get(`${apiBaseUrl}${path}`, {
        headers: { 'X-FlowPro-Tenant-Id': '' },
      })

      expect(
        response.status(),
        `${path} should not be readable without a resolvable identity`
      ).toBeGreaterThanOrEqual(400)
    }
  })
})

async function expectOkResponse(response: APIResponse, label: string) {
  expect(response.ok(), `${label} failed: ${await safeText(response)}`).toBe(
    true
  )
}

async function safeText(response: APIResponse) {
  try {
    return `${response.status()} ${await response.text()}`
  } catch {
    return String(response.status())
  }
}
