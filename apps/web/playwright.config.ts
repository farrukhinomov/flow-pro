import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.FLOWPRO_E2E_BASE_URL ?? 'http://127.0.0.1:5173'
const webPort = new URL(baseURL).port || '5173'
const reuseExistingServer =
  process.env.FLOWPRO_E2E_REUSE_SERVER === undefined
    ? !process.env.CI
    : process.env.FLOWPRO_E2E_REUSE_SERVER === 'true'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // Integrated scenarios share the seeded development tenant and database.
  fullyParallel: false,
  workers: 1,
  /**
   * One retry, not two.
   *
   * Two retries let a test that failed roughly three runs in four still pass CI
   * about three-fifths of the time. That is enough cover to keep a genuinely
   * broken test alive indefinitely, and it did: the visual sweep was
   * intermittently red for a long time because the authenticated layout blocked
   * its first paint on a network request. The retries made it survivable, so it
   * was never traced, and the suite trained everyone to discount red.
   *
   * One retry still absorbs a genuine infrastructure blip while leaving a real
   * flake visible in the failure rate.
   */
  retries: process.env.CI ? 1 : 0,
  /**
   * `list` runs alongside `github` on CI so a pass-on-retry is printed as
   * flaky. With the `github` reporter alone, a test that failed and then passed
   * looks identical to one that never failed.
   */
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    reuseExistingServer,
    timeout: 120_000,
    url: baseURL,
  },
  // The visual sweep is intentionally a separate project. It captures full-page
  // screenshots of every route at three viewports, which costs minutes and a lot
  // of browser memory. Running it alongside the functional specs starved the
  // browser and made unrelated correctness tests time out, so a screenshot cost
  // could masquerade as a correctness failure. Keeping the projects apart means
  // each failure points at its real cause.
  projects: [
    {
      name: 'functional',
      testIgnore: [/visual-qa\.spec\.ts$/, /[\\/](session|demo)[\\/]/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      testMatch: /visual-qa\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Signs in through the real session cookie against an API in Session mode, so it needs its
    // own stack (scripts/run-session-e2e.sh) and cannot share a run with the header-auth specs.
    {
      name: 'session',
      testMatch: /[\\/]session[\\/].*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
    // The public demo wipes its database, so it runs against databases of its own
    // (scripts/run-demo-e2e.sh), with a worker scheduling the reset.
    {
      name: 'demo',
      testMatch: /[\\/]demo[\\/].*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
  ],
})
