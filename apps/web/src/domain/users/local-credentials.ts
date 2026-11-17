/**
 * Passwords set for people created in the local simulation (`VITE_FLOWPRO_AUTH_MODE=local`), so
 * those people can sign in. Only a salted PBKDF2 hash is stored: the password itself never reaches
 * browser storage. Real deployments run in session mode, where the API owns passwords and nothing is
 * kept here.
 */
const LOCAL_CREDENTIALS_KEY = 'flowpro.local-user-credentials.v2'
// Earlier builds kept plain-text passwords under this key. It is removed on first use.
const LEGACY_CREDENTIALS_KEY = 'flowpro.local-user-credentials'
// OWASP's recommendation for PBKDF2-HMAC-SHA256.
const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const HASH_BITS = 256

export type LocalUserCredential = {
  email: string
  /** Base64 PBKDF2-SHA256 hash of the password. */
  hash: string
  /** Base64 random salt for {@link hash}. */
  salt: string
  userId: string
}

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined

  return window.localStorage
}

function readCredentials(): LocalUserCredential[] {
  const storage = getStorage()
  if (!storage) return []

  try {
    storage.removeItem(LEGACY_CREDENTIALS_KEY)

    const stored = storage.getItem(LOCAL_CREDENTIALS_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (credential): credential is LocalUserCredential =>
        typeof credential?.email === 'string' &&
        typeof credential?.hash === 'string' &&
        typeof credential?.salt === 'string' &&
        typeof credential?.userId === 'string'
    )
  } catch {
    return []
  }
}

function writeCredentials(credentials: LocalUserCredential[]) {
  getStorage()?.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(credentials))
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: salt as BufferSource,
    },
    key,
    HASH_BITS
  )

  return toBase64(new Uint8Array(bits))
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return difference === 0
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function listLocalUserCredentials() {
  return readCredentials()
}

/**
 * Stores the hash of a user's new password, or only updates their email when no new password is
 * given. A user who never had a password is not added.
 */
export async function upsertLocalUserCredential({
  email,
  password,
  userId,
}: {
  email: string
  password?: string
  userId: string
}) {
  const credentials = readCredentials()
  const existing = credentials.find(
    (credential) => credential.userId === userId
  )

  let secret: Pick<LocalUserCredential, 'hash' | 'salt'>
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    secret = { hash: await hashPassword(password, salt), salt: toBase64(salt) }
  } else if (existing) {
    secret = { hash: existing.hash, salt: existing.salt }
  } else {
    return
  }

  writeCredentials([
    { email: normalizeEmail(email), ...secret, userId },
    ...credentials.filter((credential) => credential.userId !== userId),
  ])
}

/** The stored credential whose email and password match, if any. */
export async function findLocalUserCredential(
  email: string,
  password: string
): Promise<LocalUserCredential | undefined> {
  const candidate = readCredentials().find(
    (credential) => credential.email === normalizeEmail(email)
  )
  if (!candidate) return undefined

  const hash = await hashPassword(password, fromBase64(candidate.salt))

  return constantTimeEquals(hash, candidate.hash) ? candidate : undefined
}
