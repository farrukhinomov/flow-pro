#!/usr/bin/env node
// Probes a running public deployment end to end: the web app, its runtime
// configuration, API readiness, and a full sign-in, request and sign-out with
// a real account. Everything is served from one origin by Caddy.
//
//   FLOWPRO_SMOKE_ORIGIN=https://demo.example.com \
//   FLOWPRO_SMOKE_USERNAME=... FLOWPRO_SMOKE_PASSWORD=... \
//   npm run test:public-runtime

const origin = (process.env.FLOWPRO_SMOKE_ORIGIN ?? '').replace(/\/+$/, '')
const username = process.env.FLOWPRO_SMOKE_USERNAME
const password = process.env.FLOWPRO_SMOKE_PASSWORD

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required.`)
}

async function expectStatus(path, expectedStatus, init = {}) {
  const url = `${origin}${path}`
  const response = await fetch(url, { redirect: 'manual', ...init })
  const text = await response.text()

  if (response.status !== expectedStatus) {
    throw new Error(
      `${url} returned HTTP ${response.status}; expected ${expectedStatus}. ${text.slice(0, 300)}`
    )
  }

  return { response, text }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} did not return valid JSON: ${error}`)
  }
}

/** Returns the session cookie as a request header value, checking its attributes. */
function readSessionCookie(response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => /^__Host-flowpro_session=/.test(value))

  if (!cookie) {
    throw new Error('Sign-in did not set the __Host-flowpro_session cookie.')
  }

  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
    if (!cookie.toLowerCase().includes(attribute.toLowerCase())) {
      throw new Error(`The session cookie is missing ${attribute}.`)
    }
  }

  return cookie.split(';')[0]
}

async function main() {
  requireValue('FLOWPRO_SMOKE_ORIGIN', origin)
  requireValue('FLOWPRO_SMOKE_USERNAME', username)
  requireValue('FLOWPRO_SMOKE_PASSWORD', password)

  console.log(`FlowPro public runtime smoke against ${origin}`)

  const page = await expectStatus('/', 200)
  if (!page.text.includes('<div id="root"')) {
    throw new Error('The web app shell was not served.')
  }
  console.log('OK web app')

  const config = await expectStatus('/config.js', 200)
  if (!config.text.includes('"VITE_FLOWPRO_AUTH_MODE": "session"')) {
    throw new Error('Runtime configuration does not select session sign-in.')
  }
  console.log('OK runtime configuration')

  await expectStatus('/health/ready', 200)
  console.log('OK health/ready')

  // A request from another site must be refused before credentials are checked.
  await expectStatus('/api/v1/auth/sign-in', 403, {
    body: JSON.stringify({ email: username, password: 'not-the-password' }),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://attacker.invalid',
    },
    method: 'POST',
  })
  console.log('OK cross-site sign-in refused')

  const signIn = await expectStatus('/api/v1/auth/sign-in', 200, {
    body: JSON.stringify({ email: username, password }),
    headers: { 'Content-Type': 'application/json', Origin: origin },
    method: 'POST',
  })
  const cookie = readSessionCookie(signIn.response)
  if (signIn.text.includes(cookie.split('=')[1])) {
    throw new Error('The session token appeared in the response body.')
  }
  console.log('OK sign-in')

  const session = parseJson(
    (
      await expectStatus('/api/v1/auth/session', 200, {
        headers: { Cookie: cookie },
      })
    ).text,
    'Session endpoint'
  )
  if (!session.userId || !Array.isArray(session.permissions)) {
    throw new Error('The session response is missing userId or permissions.')
  }
  console.log('OK auth/session')

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const events = parseJson(
    (
      await expectStatus(
        `/api/v1/attendance/me/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        200,
        { headers: { Cookie: cookie } }
      )
    ).text,
    'Attendance events endpoint'
  )
  if (!Array.isArray(events.items)) {
    throw new Error('The attendance events response is missing items.')
  }
  console.log('OK attendance/me/events')

  await expectStatus('/api/v1/auth/sign-out', 204, {
    headers: { Cookie: cookie, Origin: origin },
    method: 'POST',
  })
  await expectStatus('/api/v1/auth/session', 401, {
    headers: { Cookie: cookie },
  })
  console.log('OK sign-out ends the session')

  console.log('Public runtime smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
