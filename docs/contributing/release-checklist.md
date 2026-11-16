# Release And Verification Checklist

Use this checklist before declaring the frontend/backend pair production-ready.

The same gates are encoded in `.github/workflows/ci.yml`:

- `frontend`: `npm run check`
- `backend`: formatting, build, tests, vulnerabilities, migration drift
- `integrated-e2e`: `npm run test:e2e` against PostgreSQL and the Release API
- `session-e2e`: `npm run test:e2e:session`, the real sign-in path with the
  session cookie, registration, email confirmation, password reset and password
  change, with Mailpit catching the emails
- `demo-e2e`: `npm run test:e2e:demo`, the public demo against databases of
  its own: the shared logins, the refusal to wipe a database with other
  workspaces, and a real nightly reset
- `public-runtime-smoke`: `npm run test:public-runtime` against the live demo
  after a merge, with smoke credentials

The browser suites (`integrated-e2e`, `visual-e2e`, `session-e2e`,
`demo-e2e`) run on pull requests only: a merge to main has already passed
them.

## Client Gates

Run from `apps/web`:

```sh
npm run format:check
npm run maintenance
npm run check:runtime
npm run check
npm run test:e2e
npm run test:e2e:session
npm run test:e2e:demo
```

Expected coverage:

- lint passes
- TypeScript passes
- unit/domain/application tests pass
- production build passes
- integrated browser tests pass against backend and PostgreSQL
- responsive and visual QA smoke tests pass

For the public/staging deployment, also run:

```sh
FLOWPRO_SMOKE_ORIGIN=https://<domain> \
FLOWPRO_SMOKE_USERNAME=<user-email> \
FLOWPRO_SMOKE_PASSWORD=<password> \
npm run test:public-runtime
```

This checks the web app, its runtime configuration, API health, that a
cross-site sign-in is refused, the session cookie attributes, `/auth/session`,
the Today attendance events endpoint, and that sign-out ends the session.

## Server Gates

Run from `apps/api`:

```sh
bash scripts/check.sh
```

This verifies:

- formatting
- Release build
- tests
- known package vulnerabilities
- pending EF model changes

Also useful for focused feedback:

```sh
dotnet test FlowPro.slnx
```

## Sync Release Criteria

Do not call sync production-ready unless all are true:

1. `/sync/batches` accepts valid operations with authenticated permissions.
2. `/sync/changes` returns tenant-scoped ordered changes.
3. Frontend IndexedDB cache updates from server-side changes.
4. Backend-backed attendance clock and correction flow passes integrated e2e.
5. Rejected operations surface an actionable error.
6. Conflicts remain visible and resolvable.
7. Local database schema changes have migration notes.
8. API contract changes are documented.

## Auth Release Criteria

Do not ship auth changes unless all are true:

1. Every deployment uses `Authentication:Mode=Session`.
2. Development header auth is unavailable outside the Development environment.
3. No credential the server issues is readable from script.
4. Backend authorization checks database permissions, not client roles.
5. Session lifetime and cookie attributes are documented.
6. Cross-site state-changing requests are refused.
7. `/api/v1/auth/session` succeeds with the cookie the browser received.
8. Sign-in, sign-up and sign-out have e2e or manual smoke coverage.

Keep [public deployment](../self-hosting/public-deployment.md) aligned with
the compose files and the API settings.

## Manual Smoke Test

Use a fresh browser profile or clear FlowPro IndexedDB before testing.

1. Sign in as `founder@flowpro.local` / `superadmin`.
2. Verify Today loads.
3. Clock in.
4. Start break.
5. Resume work.
6. Clock out.
7. Edit a booking and confirm backend event count remains correct.
8. Submit an absence request.
9. Open Timesheet and Reports.
10. Open sync status and verify no failed or conflicted operations.

## Bug Gate

Do not release with unresolved high severity bugs unless the release is the
mitigation. Normal severity bugs older than seven days require an explicit
owner and ship/no-ship decision.

## Documentation Gate

For changes in these areas, docs must be updated in the same pull request:

- API contracts
- authentication
- sync protocol or local database schema
- backend command/query flow
- authorization policies
- release or deployment process
- backup/restore or storage behavior

Use [../README.md](../README.md) as the documentation entry point.
