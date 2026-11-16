const LOCAL_CREDENTIALS_KEY = 'flowpro.local-user-credentials'

export type LocalUserCredential = {
  email: string
  password: string
  userId: string
}

function readCredentials(): LocalUserCredential[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(LOCAL_CREDENTIALS_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (credential): credential is LocalUserCredential =>
        typeof credential?.email === 'string' &&
        typeof credential?.password === 'string' &&
        typeof credential?.userId === 'string'
    )
  } catch {
    return []
  }
}

function writeCredentials(credentials: LocalUserCredential[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    LOCAL_CREDENTIALS_KEY,
    JSON.stringify(credentials)
  )
}

export function listLocalUserCredentials() {
  return readCredentials()
}

export function upsertLocalUserCredential({
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

  if (!password && !existing) return

  const nextCredential: LocalUserCredential = {
    email: email.trim().toLowerCase(),
    password: password ?? existing?.password ?? '',
    userId,
  }
  const nextCredentials = [
    nextCredential,
    ...credentials.filter((credential) => credential.userId !== userId),
  ]

  writeCredentials(nextCredentials)
}
