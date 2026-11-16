import type { UserRole } from './types'

export type SessionSource = 'local-dev' | 'backend'

export type AuthSession = {
  id: string
  employeeId: string
  displayName: string
  role: UserRole
  team?: string
  source: SessionSource
  issuedAt: string
  expiresAt?: string
}

export function createLocalDevSession({
  employeeId,
  displayName,
  role,
  team,
}: {
  employeeId: string
  displayName: string
  role: UserRole
  team?: string
}): AuthSession {
  return {
    id: `local-session-${employeeId}`,
    employeeId,
    displayName,
    role,
    team,
    source: 'local-dev',
    issuedAt: new Date().toISOString(),
  }
}

export function getSessionSourceLabel(source: SessionSource) {
  return source === 'backend'
    ? 'Backend authenticated session'
    : 'Local simulated session'
}
