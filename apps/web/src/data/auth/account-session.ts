import { isAuthenticationError } from '@/data/api/api-error'
import { getCurrentAuthSession } from '@/data/api/auth.api'
import type { UserRole } from '@/domain/users/types'
import { createSessionAuthUser, useAuthStore } from '@/stores/auth-store'
import { localDataOwner } from './local-data-owner'
import { claimLocalData } from './workspace-data'

const userRoles = [
  'superadmin',
  'admin',
  'hr',
  'manager',
  'employee',
] satisfies UserRole[]

export type WorkspaceSessionState = 'ready' | 'no-workspace'

/**
 * Loads who the server session belongs to inside a workspace and caches it for display.
 *
 * A 401 here means the session is valid but no workspace membership resolves yet, which is the
 * state right after registration. Callers that just signed in send the user to claim a workspace;
 * callers restoring a page treat it as signed out.
 */
export async function loadWorkspaceSession(): Promise<WorkspaceSessionState> {
  try {
    const session = await getCurrentAuthSession()
    await claimLocalData(localDataOwner(session.tenantId, session.userId))

    useAuthStore.getState().auth.setUser(
      createSessionAuthUser({
        email: session.email,
        name: session.displayName,
        roles: toUserRoles(session.roles),
        userId: session.userId,
      })
    )

    return 'ready'
  } catch (error) {
    if (isAuthenticationError(error)) {
      useAuthStore.getState().auth.setUser(null)
      return 'no-workspace'
    }

    throw error
  }
}

export function toUserRoles(roles: string[]): UserRole[] {
  const known = roles.filter((role): role is UserRole =>
    (userRoles as readonly string[]).includes(role)
  )

  return known.length > 0 ? known : ['employee']
}
