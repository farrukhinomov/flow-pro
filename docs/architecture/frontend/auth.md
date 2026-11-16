# Frontend Auth Flow

The frontend has two auth modes, chosen by `VITE_FLOWPRO_AUTH_MODE`:

- `session` (the default): email and password against the FlowPro API, which
  keeps the session in an HttpOnly cookie. Every real deployment uses this.
- `local`: an in-browser simulation with seeded demo users, for UI work without
  a backend.

Signed-in accounts without a workspace go to [self-serve signup](#self-serve-signup)
instead of being rejected.

The backend never trusts client roles. UI roles control what the interface shows;
API authorization is enforced by the server using tenant, membership, role and
permission records. See [Backend auth](../backend/auth.md).

## Session Sign-In

Source files:

- `src/features/auth/sign-in/components/user-auth-form.tsx`
- `src/data/api/account.api.ts`
- `src/data/auth/account-session.ts`
- `src/data/auth/auth-mode.ts`
- `src/stores/auth-store.ts`
- `src/data/api/http-client.ts`

Flow:

1. The sign-in form posts to `POST /api/v1/auth/sign-in`. The API sets the
   session cookie; the response body carries only the account.
2. `loadWorkspaceSession()` calls `GET /api/v1/auth/session` and caches the
   membership (name, roles) in the auth store for display.
3. A 401 there means the account has no workspace yet, and the form continues
   to `/claim-workspace`.

With two-step sign-in, the sign-in call answers `202` and the form goes to
`/two-factor` (`src/features/auth/two-factor/index.tsx`), keeping the redirect.
That page posts the code to `POST /api/v1/auth/sign-in/two-factor`, offers a
recovery code instead, and sends the person back to sign in when the 5-minute
challenge has expired. Both pages finish through `useFinishSignIn()`
(`src/features/auth/sign-in/use-finish-sign-in.ts`), so they load the workspace
and redirect the same way. The challenge lives in an HttpOnly cookie, like the
session.

The browser never holds a token. Script cannot read the cookie, so a cross-site
scripting bug cannot steal the session. `flowProApi` sends requests with
`withCredentials`, which matters only when the API runs on another local port.

Ending a session:

- Sign-out calls `POST /api/v1/auth/sign-out` before clearing the store, so the
  server session is revoked even if the cookie was copied.
- When any ordinary endpoint answers 401 while a user is cached, the session
  ended elsewhere (signed out on another device, revoked, expired). The HTTP
  client clears the store and returns to `/sign-in` with the current page as
  the redirect. Account and workspace-claim endpoints are excluded because a
  401 there is an expected answer their callers handle.
- `_authenticated` checks the cached user. Without one it asks the server once,
  since the cache expires sooner than the server session.

Runtime configuration (`/config.js`, served by Caddy from the container
environment):

```text
VITE_FLOWPRO_AUTH_MODE=session
VITE_FLOWPRO_REGISTRATION_ENABLED=true|false
VITE_FLOWPRO_DEMO_MODE=true|false
VITE_FLOWPRO_API_BASE_URL=<only when the API is on another origin>
```

In the container stack the web app and the API share one origin, so
`VITE_FLOWPRO_API_BASE_URL` stays unset and defaults to `/api/v1`.

With `VITE_FLOWPRO_DEMO_MODE=true` (`FLOWPRO_DEMO_MODE` in the container), the
sign-in page asks `GET /api/v1/demo` for the shared logins and shows a button
per role (`src/features/auth/sign-in/components/demo-logins.tsx`). For a shared
login the Security page shows why its settings cannot change, and hides the
forms and the buttons that would sign out other visitors.

## Self-Serve Signup

Source files:

- `src/features/auth/sign-up/index.tsx`
- `src/features/onboarding/claim-workspace.tsx`
- `src/features/onboarding/onboarding-guard.ts`
- `src/data/api/onboarding.api.ts`
- `src/application/onboarding-workflow.ts`
- `src/routes/(auth)/sign-up.tsx`, `src/routes/(auth)/claim-workspace.tsx`
- `src/routes/_authenticated/onboarding.tsx`

Flow:

1. `/sign-up` posts name, email and password to `POST /api/v1/auth/register`.
   The account is created and signed in at once. The form asks for at least 12
   characters, mirroring the server policy; the server is authoritative.
2. The app continues to `/claim-workspace`, which reads
   `GET /onboarding/workspace` for a suggested name and posts the confirmed
   name to provision the tenant. The new membership is linked to the account.
3. `loadWorkspaceSession()` now succeeds and the app navigates to `/onboarding`.
4. The four-step wizard runs, then navigates to Today.

When `VITE_FLOWPRO_REGISTRATION_ENABLED=false` (the public demo, or
invitation-only instances), `/sign-up` explains that new accounts cannot be
created and the sign-in page hides the link. The API refuses registration on
its own as well.

Route guards:

- `/claim-workspace` needs session mode and no resolved workspace. Whether a
  server session exists is only known to the server, so the page shows a
  sign-in prompt when the claim state answers 401.
- `_authenticated/route.tsx` sends members of a workspace with unfinished setup
  to `/onboarding`. The guard caches state per session in
  `onboarding-guard.ts` and **fails open**: FlowPro is offline-capable, so an
  unreachable API must never block navigation for a workspace that is already
  set up. Call `resetOnboardingGuard()` after finishing setup and on sign-out.

The wizard orchestrates existing workflows rather than duplicating settings.
`onboarding-workflow.ts` mirrors the company step into the attendance policy
config so Today, Timesheet, Planning, and Reports pick up country, region, and
target hours without a second setup pass, sends invitations through
`inviteUserWorkflow`, and clocks in through `attendanceWorkflow`.

## Password Reset And Email Confirmation

Source files:

- `src/features/auth/account-recovery/index.tsx`
- `src/data/auth/link-token.ts`
- `src/routes/(auth)/forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`,
  `confirm-email-change.tsx`

- `/forgot-password` posts the email and always shows the same message, as
  the API answers the same for every email.
- `/reset-password`, `/verify-email` and `/confirm-email-change` read the token from the URL fragment
  with `useLinkToken()`, which removes it from the address bar after the first
  render. A missing or malformed token shows a "link does not work" message
  with a way to ask for a new one.
- After a reset every session of the account has ended, so the page clears the
  auth store before sending the person to sign in.
- `/verify-email` and `/confirm-email-change` share `EmailLinkPage`, which
  posts the token once; a ref guards against React running the effect twice,
  which would spend the single-use token. After an email change, a browser
  signed in to that account updates the cached user to the new address.

All four routes redirect to sign-in in local simulation mode, which has no
server to send mail.

## Security Settings

`/settings/security` (`src/features/settings/security/index.tsx`) shows the
account from `GET /auth/account`:

- the email address and whether it is confirmed, with a button to resend the
  confirmation link
- a change-email form that asks for the new address and the current password;
  the address changes only when the link sent to it is opened
- a change-password form that asks for the current password; this browser
  stays signed in and every other session ends
- the signed-in devices, named from the user agent by `describeUserAgent()`
  (`src/lib/user-agent.ts`), with the current one marked; any other one can be
  signed out, or all of them at once
- two-step sign-in (`two-factor-section.tsx`): after the current password, a
  QR code (drawn with `uqr` as one SVG path, black on white in every theme for
  scanners) and the key to type by hand, then a code to confirm. The recovery
  codes are shown once, to copy or download. While it is on, the page shows how
  many recovery codes are unused, creates new ones, or turns it off; each needs
  the current password

The page and its menu entry exist only in session mode.

## Invitations

`/accept-invitation` (`src/features/auth/invitation/index.tsx`) reads the
token, asks the API what it is for, and then offers one of: joining with the
signed-in account, signing out of an account with another address, signing in
with the invited address, or creating an account. The token waits in this
tab's session storage while the person signs in, and sign-in returns to the
page even for an account with no workspace yet. Users with status Invited get
"Resend invitation" in their row menu.

Every link page reloads when a newer link is opened in the same tab, because
only the URL fragment changes and browsers would otherwise keep the old token.

## Workspaces And Local Data

People who belong to several workspaces get a "Workspaces" group in the user
menu (`src/features/workspaces/workspace-menu.tsx`); everyone else sees no
change. Switching:

1. sends changes still waiting in the outbox, and refuses to switch while any
   cannot be sent, so they are neither lost nor sent into the other workspace
2. switches the session with `POST /auth/workspace`
3. clears the local database and the workspace caches, reloads the session
   and starts the app fresh with a full page load

The local database and cached settings belong to one membership
(`src/data/auth/workspace-data.ts`). Whenever the session loads, the
membership is compared with the recorded owner; data of another person or
another workspace, or data of unknown owner, is cleared before anything reads
it. This also covers a shared computer where one person signs out and another
signs in.

## Local Simulation

Source files:

- `src/features/auth/sign-in/components/user-auth-form.tsx`
- `src/domain/users/seeds.ts`
- `src/domain/users/local-credentials.ts`
- `src/stores/auth-store.ts`

Flow:

1. The sign-in form matches the entered email and password against seeded or
   locally stored demo credentials.
2. The frontend creates a local auth user through `createLocalAuthUser()` and
   stores `local-session-<employeeId>` as its marker.
3. When `VITE_FLOWPRO_DEV_HEADER_AUTH=true`, `flowProApi` sends development
   identity headers for that user to an API running with
   `Authentication:Mode=DevelopmentHeaders`. The integrated browser tests use
   this.

```text
VITE_FLOWPRO_DEV_HEADER_AUTH=true
VITE_FLOWPRO_DEV_TENANT_ID=01975fa8-7590-7000-8000-000000000001
VITE_FLOWPRO_DEV_USER_ID=01975fa8-7590-7000-8000-000000000002
```

This is a development and test convenience only. The API refuses to start in
development header mode outside the Development environment.

## Auth Store Responsibilities

`src/stores/auth-store.ts` owns:

- The current user as the interface shows them (a display cache).
- The local simulation marker.
- Expiry of the display cache.
- Safe redirect path validation.

The store does not authorize anything. Treat it as a UI cache.

## Rules For Future Changes

1. Never store a credential the server issued in script-readable storage.
2. Keep request behavior (credentials, 401 handling) in
   `src/data/api/http-client.ts`.
3. Keep account calls in `src/data/api/account.api.ts`.
4. Keep backend claims and permission changes documented in
   [Backend auth](../backend/auth.md).
5. Add e2e coverage when changing sign-in, sign-out or session handling.
