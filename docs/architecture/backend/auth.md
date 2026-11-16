# Backend Authentication And Authorization

FlowPro separates authentication from authorization.

- Authentication proves who the caller is.
- Authorization decides what that caller can do inside a tenant.

The server never trusts frontend role checks as authorization.

## Source Files

- `src/FlowPro.Domain/Identity/Account.cs`, `AccountSession.cs`, `AccountSecurityEvent.cs`, `AccountToken.cs`
- `src/FlowPro.Application/Accounts/AccountSessionHandler.cs`
- `src/FlowPro.Application/Accounts/AccountRecoveryHandler.cs`, `AccountMailbox.cs`
- `src/FlowPro.Application/Accounts/AccountSecurityHandler.cs`, `CurrentPasswordCheck.cs`
- `src/FlowPro.Application/Accounts/AccountTwoFactorHandler.cs`, `Totp.cs`, `RecoveryCodes.cs`
- `src/FlowPro.Infrastructure/Email/`
- `src/FlowPro.Infrastructure/Identity/AccountCredentials.cs`
- `src/FlowPro.Api/Authentication/AccountEndpoints.cs`
- `src/FlowPro.Api/Authentication/SessionAuthenticationHandler.cs`
- `src/FlowPro.Api/Authentication/SessionCookie.cs` (also the two-step challenge cookie)
- `src/FlowPro.Api/Authentication/AuthenticatorKeyProtector.cs`
- `src/FlowPro.Api/Authentication/CrossSiteRequestProtection.cs`
- `src/FlowPro.Api/Authentication/FlowProClaimsTransformation.cs`
- `src/FlowPro.Api/Authentication/DevelopmentAuthenticationHandler.cs`
- `src/FlowPro.Api/Authentication/PermissionAuthorization.cs`
- `src/FlowPro.Infrastructure/Identity/PermissionChecker.cs`

## Accounts, Memberships And Sessions

FlowPro signs people in itself. There is no external identity provider to run.

- An **account** (`identity.accounts`) is one person's sign-in identity across
  the whole instance: email, password hash (ASP.NET Core Identity's PBKDF2
  hasher), lockout state and a security stamp. It holds nothing tenant-specific.
- A **membership** (`identity.users`) is that person inside one tenant, with
  roles and permissions. It points at its account through `account_id`.
- A **session** (`identity.account_sessions`) is one signed-in browser. The
  browser holds a 256-bit random token in an HttpOnly cookie; the database
  stores only its SHA-256 hash. Revoking the row signs the browser out on its
  next request.

Endpoints, all under `/api/v1/auth`:

| Endpoint | Purpose |
| --- | --- |
| `POST /register` | Creates an account and signs it in. Off when `Authentication:Session:RegistrationEnabled` is `false`. |
| `POST /sign-in` | Checks the password and issues a session cookie, or for an account with two-step sign-in a challenge (see below). |
| `POST /sign-in/two-factor` | Answers the challenge with an authenticator or recovery code and issues the session cookie. |
| `POST /sign-out` | Revokes the session and clears the cookie. |
| `GET /session` | Returns the membership the session acts as, with roles and permissions. 401 when the account has no workspace yet. |
| `POST /password/forgot` | Emails a reset link. Always 202, whether or not the email has an account. |
| `POST /password/reset` | Sets a new password with a reset token and ends every session of the account. |
| `POST /email/verify` | Confirms the email address with a confirmation token. |
| `POST /email/verification` | Sends a new confirmation link to the signed-in account. |
| `POST /email/change` | Checks the current password and sends a confirmation link to the new address. Always 202, whether or not the address is free. |
| `POST /email/change/confirm` | Moves the account to the address the token was sent to. |
| `GET /account` | The signed-in account: email, confirmation state, two-step sign-in state with unused recovery codes, and its active sessions, the current one marked. |
| `POST /invitation/preview` | The workspace and address an invitation link is for, and whether that address has an account. |
| `POST /invitation/accept` | Joins the workspace with the signed-in account, whose address must match, and moves this session there. |
| `POST /invitation/accept-new` | Creates the invited person's account (address confirmed), joins the workspace and signs in there. Works while registration is off. |
| `GET /workspaces` | The workspaces the account belongs to, the one this session acts in marked. |
| `POST /workspace` | Makes this session act in another workspace of the account. Other sessions stay where they are. |
| `POST /password/change` | Checks the current password, sets a new one, keeps this session and ends all others. |
| `DELETE /sessions/{id}` | Ends one other session of the account. The current one is ended by signing out. |
| `POST /sessions/revoke-others` | Ends every session of the account except the current one. |

Request flow:

1. `SessionAuthenticationHandler` reads the cookie, hashes the token and loads
   the session. Expired, revoked or unknown sessions clear the cookie.
2. `FlowProClaimsTransformation` resolves the membership by `account_id`,
   in the session's chosen workspace (`account_sessions.active_tenant_id`)
   while the account still belongs to it. Otherwise an account with exactly
   one membership resolves to it, and one with several stays unresolved
   rather than guessing. Sign-in chooses the workspace the account used last,
   or the one it joined first, so a new session always has one.
3. `HttpCurrentRequestContext` extracts tenant and user identifiers.
4. The endpoint policy checks the required permission against PostgreSQL.

Protections:

- Cookie: `__Host-flowpro_session` outside Development, `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`. The token never appears in a response body.
- Cross-site requests: `CrossSiteRequestProtection` refuses state-changing
  requests whose `Origin` or `Sec-Fetch-Site` shows another site, unless the
  origin is in `Cors:AllowedOrigins`.
- Lifetimes: 30 days absolute, 7 days idle (`Authentication:Session`).
- Passwords: at least 12 characters with 4 distinct characters; no composition
  rules. Five failures lock the account for 15 minutes.
- Rate limits per client address, set in the `RateLimiting` section:
  `SignInPerMinute` (10; sign-in and its second step, sign-out, password reset,
  password change and two-step sign-in settings),
  `AccountEmailPer15Minutes` (5; reset, confirmation and email change) and
  `RegistrationsPerHour` (5). Raise them when many people share one public
  address, such as an office behind one NAT. They cannot be switched off.
- Errors: a wrong email and a wrong password get the same answer and take about
  the same time.
- Every sign-in, failure, lockout, registration, sign-out, reset,
  confirmation, password change, email change, revoked session and two-step
  sign-in change or failed code is written to
  `identity.account_security_events`.
- Changing the password requires the current one, and a wrong one counts
  towards lockout like a failed sign-in, so a stolen session cannot be used to
  guess it. The owner gets an email saying the password changed.
- Session identifiers from another account are answered like unknown ones.

## Two-Step Sign-In

An account can require a code from an authenticator app (RFC 6238: HMAC-SHA1,
six digits, 30 seconds, as every common app expects) on top of the password.

Setting it up, under `/api/v1/auth/two-factor`:

| Endpoint | Purpose |
| --- | --- |
| `POST /setup` | Checks the current password and creates a new secret. Returns it in Base32 and as an `otpauth://` link for a QR code. Two-step sign-in stays off. |
| `POST /enable` | Turns it on with a first code from the app, returns 10 recovery codes once, and ends every other session, since those signed in with the password alone. |
| `POST /disable` | Checks the current password, turns it off and deletes the recovery codes. |
| `POST /recovery-codes` | Checks the current password and replaces every recovery code. |

Signing in:

1. `POST /sign-in` with the right password answers `202` with
   `{ "twoFactorRequired": true }` instead of a session, and sets a challenge
   cookie (`__Host-flowpro_two_factor`, HttpOnly, `SameSite=Strict`). The
   challenge is an `account_tokens` row of purpose `two_factor_sign_in`: 256
   random bits, stored as a hash, single use, valid for 5 minutes.
2. `POST /sign-in/two-factor` with `{ "code" }` answers it. Six digits are
   checked as an authenticator code, anything else as a recovery code. Success
   clears the challenge cookie and sets the session cookie.

Protections:

- **Lockout covers the code.** A wrong code counts towards the same lockout as
  a wrong password (5 failures, 15 minutes). For an account with two-step
  sign-in a correct password does not reset that count; only a correct code
  does. Otherwise knowing the password would give unlimited guesses at the
  code. The attempt that locks the account also spends the challenge.
- **No replay.** A code is accepted one 30-second step either side of the
  server clock, and only for a step later than the last accepted one
  (`accounts.authenticator_time_step`), so an observed code cannot be used
  again.
- **The secret is encrypted** with ASP.NET Core Data Protection
  (`accounts.authenticator_key`) under the purpose
  `FlowPro.Accounts.AuthenticatorKey.v1`. A copy of the database alone cannot
  produce codes. The Data Protection keys must persist and be backed up: losing
  them means nobody with two-step sign-in can sign in until an administrator
  turns it off for them in the database.
- **Recovery codes** (`identity.account_recovery_codes`) are 16 characters from
  an alphabet without look-alikes, about 79 bits each, stored as SHA-256
  hashes and usable once. They are shown only when created.
- **Notices.** Turning it on or off, new recovery codes and every sign-in with
  a recovery code email the owner, without a link or secret.
- A password reset leaves two-step sign-in on: the reset proves the mailbox,
  not the phone.

Errors: `account.two_factor_code_invalid` (wrong code; try again),
`account.two_factor_challenge_expired` (start again with the password),
`account.two_factor_already_enabled`, `account.two_factor_not_enabled`,
`account.two_factor_setup_missing`.

## Email Confirmation And Password Reset

Both flows prove that the person reads the account's mailbox:

1. The API issues a single-use token (`identity.account_tokens`): 256 random
   bits, stored only as a SHA-256 hash, tied to one purpose, valid for 2 days
   (confirmation) or 1 hour (reset). Issuing a new one consumes the older ones,
   so only the newest link works.
2. The email links to `{AppBaseUrl}/verify-email#token=...` or
   `/reset-password#token=...`. The token is in the URL fragment, so it never
   reaches a server log or a `Referer` header, and the page removes it from
   the address bar once read. `Authentication:Email:AppBaseUrl` is configured,
   never taken from the request, so a forged `Host` header cannot point a link
   elsewhere.
3. Registration sends a confirmation link. A reset sets the new password
   through Identity's password validators, lifts any lockout, confirms the
   email, and revokes every session of the account.

A reset request for an unknown email answers exactly like one for a known
email. Requests that send mail are limited to 5 per 15 minutes per IP.
Confirmation is recorded (`accounts.email_confirmed`) but not yet required for
anything.

## Invitations

Administrators invite people from Users (`POST /directory/users/invitations`).
That creates the membership with status `Invited` and emails a single-use link,
`{AppBaseUrl}/accept-invitation#token=...`, valid for 7 days
(`identity.membership_invitations`, hashed like every other token). Sending it
again (`POST /directory/users/{id}/invitation`) revokes the previous link.

- Someone without an account chooses a name and password on the accept page;
  the account is created with the address confirmed, since the link reached it.
  This stays open when registration is off, so an instance can be
  invitation-only.
- Someone with an account signs in with the invited address and joins. An
  account with another address cannot take the invitation.
- Accepting links the membership to the account, activates it, and starts the
  session in that workspace. It runs in the invitation's tenant scope.
- A deactivated membership, or one someone already signs in to, cannot be
  taken up; its links stop working.

## Changing The Email Address

1. `POST /email/change` checks the current password, which counts towards
   lockout like a password change, so a stolen session alone cannot move the
   account to someone else's mailbox.
2. If the new address is free, a single-use `email_change` token valid for a
   day is stored with the address (`account_tokens.new_email`) and the link
   `{AppBaseUrl}/confirm-email-change#token=...` goes to the new address. If
   another account already uses it, that mailbox gets a notice without a link
   instead, and the request answers the same, so it does not reveal who has an
   account.
3. Until the link is opened the account keeps its address and signs in with it.
   Invitations match people by email, so an address is only taken over once
   its mailbox is proven.
4. Opening the link moves the account and confirms the address, changes the
   security stamp, consumes every other outstanding link of the account (a
   reset link sent to the old address stops working), and moves the
   memberships that still showed the old address. A membership address an
   administrator set to something else stays. The old address gets a notice
   without a link. Signed-in sessions stay signed in.
5. If someone registered the address in the meantime, confirmation fails with
   `account.email_taken` and nothing changes.

Mail leaves through an in-memory queue drained by `EmailDispatcher`, a hosted
service in the API that sends with MailKit over SMTP and retries twice. The
queue keeps response times independent of the mail server. Queued mail is lost
if the API stops, which is acceptable for links the person can ask for again.
Settings:

| Key | Meaning |
| --- | --- |
| `Email:Smtp:Host` | SMTP server. Mail is off while empty; the API logs each unsent subject. |
| `Email:Smtp:Port`, `Email:Smtp:Security` | Default 587 with `StartTls`; `SslOnConnect` for 465; `None` only for Mailpit. |
| `Email:Smtp:Username`, `Email:Smtp:Password` | Optional credentials. |
| `Email:From`, `Email:FromName` | Sender. `From` is required once a host is set. |
| `Authentication:Email:AppBaseUrl` | Where the web app is served. Required outside Development when mail is on. |

The local stack sends everything to Mailpit at http://localhost:8025.

## Public Demo Logins

With `Demo:Enabled` (see the self-hosting guide), the demo's shared logins
(`DemoWorkspace.Logins`, one per role) are protected by `SharedAccountPolicy`,
because every visitor uses the same few accounts:

- Password, email and two-step sign-in changes, and ending other sessions,
  answer `403 account.shared_demo_account`.
- Wrong passwords do not count towards their lockout (`AccountCredentials`).
  The password is public, and a lockout would lock out every visitor.
- Editing or deactivating their memberships answers `403 user.shared_demo_login`.
- `GET /account` reports `isSharedDemoLogin`, so the Security page explains
  instead of offering forms that would fail.
- `GET /api/v1/demo` (anonymous) lists the logins and the password for the
  sign-in page, and answers 404 when the demo is off.

The worker's `DemoResetWorker` seeds the demo through `WorkspaceProvisioner`,
the same code a real workspace claim uses, and wipes and reseeds it nightly in
one transaction. It refuses to wipe a database that holds another workspace.

## Development Header Authentication

For automated tests only. Enabled when both conditions are true, and the API
refuses to start if the mode is set outside Development:

- environment is `Development`
- `Authentication:Mode=DevelopmentHeaders`

The handler reads:

```text
X-FlowPro-Tenant-Id
X-FlowPro-User-Id
X-FlowPro-Subject   (a principal with no membership yet)
```

If the headers are absent, it uses seeded development IDs. Local development
uses real sessions instead: with `Database:DevelopmentAccountPassword` set, the
seed gives `founder@flowpro.local` and `hannah.fischer@flowpro.test` accounts.

## Authorization Policies

`AddFlowProAuthorization()` registers one policy for each permission key.
Endpoints should call:

```csharp
.RequireAuthorization(PermissionKeys.SomePermission)
```

Use the narrowest permission that matches the action. Do not use a broad
administrative permission to make a test pass.

## Permission Model

The database owns:

- tenants
- users
- roles
- permissions
- user-role assignments
- role-permission assignments
- employee identity links

Authorization queries require:

- matching tenant
- active tenant
- active user
- assigned role
- assigned permission

## Frontend Relationship

The frontend auth store controls UI state and convenience redirects. Backend
authorization remains authoritative. A hidden button is not a security control.

Frontend docs:

- [Frontend auth](../frontend/auth.md)

## Auth Change Checklist

1. Decide whether the change affects authentication, authorization, or both.
2. Update configuration docs if an environment variable changes.
3. Add or update permission keys for new protected actions.
4. Require the narrowest endpoint policy.
5. Add application/API tests for permission success and denial where possible.
6. Verify development header auth remains Development-only and session cookies
   keep their attributes.
7. Run `bash scripts/check.sh`.
