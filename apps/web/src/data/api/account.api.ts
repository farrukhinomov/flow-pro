import { flowProApi } from './http-client'

/**
 * Account sign-in against the FlowPro API.
 *
 * The API answers with the account only. The session itself is an HttpOnly cookie that the
 * browser stores and sends on its own; no token is ever readable from script.
 */
export type SignedInAccount = {
  accountId: string
  email: string
  displayName: string
}

/**
 * Either signed in, or the password was right and the account also needs a code from an
 * authenticator app. The challenge itself is an HttpOnly cookie, like the session.
 */
export type PasswordSignInResult =
  | { status: 'signed-in'; account: SignedInAccount }
  | { status: 'code-required' }

export async function signInWithPassword(
  email: string,
  password: string
): Promise<PasswordSignInResult> {
  const response = await flowProApi.post<SignedInAccount>('/auth/sign-in', {
    email,
    password,
  })

  return response.status === 202
    ? { status: 'code-required' }
    : { status: 'signed-in', account: response.data }
}

/** Answers the sign-in challenge with an authenticator code or a recovery code. */
export async function completeTwoFactorSignIn(code: string) {
  const response = await flowProApi.post<SignedInAccount>(
    '/auth/sign-in/two-factor',
    { code }
  )

  return response.data
}

export async function registerAccount(input: {
  displayName: string
  email: string
  password: string
}) {
  const response = await flowProApi.post<SignedInAccount>(
    '/auth/register',
    input
  )

  return response.data
}

/** Ends the server session. Succeeds even when the session has already expired. */
export async function signOutOfSession() {
  await flowProApi.post('/auth/sign-out')
}

/** Asks for a reset link. The API answers the same whether or not the email has an account. */
export async function requestPasswordReset(email: string) {
  await flowProApi.post('/auth/password/forgot', { email })
}

/** Sets a new password with the token from a reset link. Ends every session of the account. */
export async function resetPassword(token: string, password: string) {
  await flowProApi.post('/auth/password/reset', { token, password })
}

/** Confirms the email address with the token from a confirmation link. */
export async function verifyEmail(token: string) {
  await flowProApi.post('/auth/email/verify', { token })
}

/**
 * Sends a confirmation link to the new address. The account keeps its current address until the
 * link is opened. Answers the same whether or not the new address is free.
 */
export async function requestEmailChange(
  currentPassword: string,
  newEmail: string
) {
  await flowProApi.post('/auth/email/change', { currentPassword, newEmail })
}

/** Moves the account to the address the link was sent to, and returns that address. */
export async function confirmEmailChange(token: string) {
  const response = await flowProApi.post<{ email: string }>(
    '/auth/email/change/confirm',
    { token }
  )
  return response.data.email
}

/** Sends a new confirmation link to the signed-in account. */
export async function resendEmailVerification() {
  await flowProApi.post('/auth/email/verification')
}

export type AccountSessionSummary = {
  sessionId: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  userAgent: string | null
  ipAddress: string | null
  isCurrent: boolean
}

export type AccountOverview = {
  accountId: string
  email: string
  displayName: string
  emailConfirmed: boolean
  sessions: AccountSessionSummary[]
  twoFactorEnabled: boolean
  recoveryCodesLeft: number
  /** A shared demo login: its sign-in settings cannot be changed. */
  isSharedDemoLogin: boolean
}

export async function getAccountOverview() {
  const response = await flowProApi.get<AccountOverview>('/auth/account')

  return response.data
}

/** Keeps this session and ends every other one of the account. */
export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  const response = await flowProApi.post<{ otherSessionsEnded: number }>(
    '/auth/password/change',
    { currentPassword, newPassword }
  )

  return response.data
}

export type AuthenticatorSetup = {
  /** The secret in Base32, grouped for typing it into an app by hand. */
  sharedKey: string
  /** The `otpauth://` link to show as a QR code. */
  authenticatorUri: string
}

/** Creates a new authenticator secret. Two-step sign-in stays off until a code confirms it. */
export async function startAuthenticatorSetup(currentPassword: string) {
  const response = await flowProApi.post<AuthenticatorSetup>(
    '/auth/two-factor/setup',
    { currentPassword }
  )

  return response.data
}

/** Turns two-step sign-in on and returns the recovery codes, shown only this once. */
export async function enableTwoFactor(code: string) {
  const response = await flowProApi.post<{
    recoveryCodes: string[]
    otherSessionsEnded: number
  }>('/auth/two-factor/enable', { code })

  return response.data
}

export async function disableTwoFactor(currentPassword: string) {
  await flowProApi.post('/auth/two-factor/disable', { currentPassword })
}

/** Replaces every recovery code with new ones, shown only this once. */
export async function regenerateRecoveryCodes(currentPassword: string) {
  const response = await flowProApi.post<{ recoveryCodes: string[] }>(
    '/auth/two-factor/recovery-codes',
    { currentPassword }
  )

  return response.data.recoveryCodes
}

export async function revokeSession(sessionId: string) {
  await flowProApi.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`)
}

export async function revokeOtherSessions() {
  const response = await flowProApi.post<{ count: number }>(
    '/auth/sessions/revoke-others'
  )

  return response.data
}

export type WorkspaceSummary = {
  tenantId: string
  name: string
  isCurrent: boolean
}

/** The workspaces the signed-in account belongs to, with the one this session acts in. */
export async function listWorkspaces() {
  const response = await flowProApi.get<{ workspaces: WorkspaceSummary[] }>(
    '/auth/workspaces'
  )
  return response.data.workspaces
}

/** Makes this session act in another workspace. Other devices stay where they are. */
export async function switchWorkspace(tenantId: string) {
  await flowProApi.post('/auth/workspace', { tenantId })
}

export type InvitationPreview = {
  workspaceName: string
  email: string
  displayName: string
  accountExists: boolean
}

/** What an invitation link leads to. Fails with `account.token_invalid` for a dead link. */
export async function previewInvitation(token: string) {
  const response = await flowProApi.post<InvitationPreview>(
    '/auth/invitation/preview',
    { token }
  )
  return response.data
}

/** Joins the workspace with the signed-in account, whose address must match the invitation. */
export async function acceptInvitation(token: string) {
  await flowProApi.post('/auth/invitation/accept', { token })
}

/** Creates the invited person's account, joins the workspace and signs in. */
export async function acceptInvitationWithNewAccount(
  token: string,
  displayName: string,
  password: string
) {
  await flowProApi.post('/auth/invitation/accept-new', {
    token,
    displayName,
    password,
  })
}

export type DemoInfo = {
  /** Public by design: every visitor shares these logins. */
  password: string
  /** When the demo is wiped every day, `HH:mm` in UTC. */
  resetAtUtc: string
  logins: { roleKey: string; email: string; displayName: string }[]
}

/** The shared demo logins. Fails with 404 on an instance that does not run the demo. */
export async function getDemoInfo() {
  const response = await flowProApi.get<DemoInfo>('/demo')
  return response.data
}
