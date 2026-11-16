import { useEffect, useState } from 'react'
import { applicationStore } from '@/application/application-store'
import type { EmployeeUser } from '@/domain/users/types'
import { useAuthStore } from '@/stores/auth-store'

type CurrentEmployeeState = {
  employee: EmployeeUser | null
  isLoading: boolean
}

/**
 * Loads the signed-in user's directory record.
 *
 * The Account and Profile settings pages used to resolve this from
 * `domain/users/seeds`, which only contains development fixtures. For any real
 * tenant user the lookup returned undefined, so Account rendered "-" for team,
 * manager, and work pattern, and Profile rendered blank name, username, and
 * phone fields. Profile was worse than cosmetic: its submit handler was guarded
 * on the seed record existing, so saving reported success while persisting
 * nothing.
 *
 * Reads through `applicationStore`, which serves the cached snapshot first and
 * then refreshes from the directory workflow.
 */
/** Tracks which id a result belongs to so a stale record is never returned. */
type LoadedEmployee = {
  employee: EmployeeUser | null
  forEmployeeId: string
}

/**
 * One directory read per page load, shared by the Account and Profile pages.
 *
 * Both read the same record, and fetching per page added a concurrent request
 * that competed with the authenticated layout's blocking onboarding-state
 * guard. Cached for the same reason, and in the same shape, as the onboarding
 * guard and the preferences gateway.
 */
let directoryRead: Promise<EmployeeUser[]> | null = null

export function resetCurrentEmployeeCache() {
  directoryRead = null
}

function readDirectory() {
  directoryRead ??= applicationStore.listUsers({}).catch((error: unknown) => {
    // Never cache a failure: the next settings page should be able to retry.
    directoryRead = null
    throw error
  })

  return directoryRead
}

export function useCurrentEmployee(): CurrentEmployeeState {
  const authUser = useAuthStore((state) => state.auth.user)
  const employeeId = authUser?.accountNo
  const [loaded, setLoaded] = useState<LoadedEmployee | null>(null)

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    const select = (users: EmployeeUser[]) => ({
      employee: users.find((user) => user.id === employeeId) ?? null,
      forEmployeeId: employeeId,
    })

    void readDirectory()
      .then((users) => {
        if (!cancelled) setLoaded(select(users))
      })
      .catch(() => {
        // The directory is unreachable. Resolve to "no record" so the caller
        // stops showing a loading state instead of hanging forever.
        if (!cancelled) setLoaded({ employee: null, forEmployeeId: employeeId })
      })

    return () => {
      cancelled = true
    }
  }, [employeeId])

  // Derived rather than assigned in the effect: signing out has nothing to
  // load, and a setState in the effect body would cascade an extra render.
  if (!employeeId) return { employee: null, isLoading: false }

  if (loaded?.forEmployeeId !== employeeId) {
    return { employee: null, isLoading: true }
  }

  return { employee: loaded.employee, isLoading: false }
}
