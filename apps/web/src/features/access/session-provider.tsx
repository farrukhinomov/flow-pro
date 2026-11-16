import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { listManagerDelegations } from '@/data/local/delegations.repo'
import { defaultViewer, type AppViewer } from '@/domain/access/access-control'
import { createLocalDevSession, type AuthSession } from '@/domain/users/session'
import { useAuthStore } from '@/stores/auth-store'

type SessionContextValue = {
  availableViewers: AppViewer[]
  session: AuthSession
  viewer: AppViewer
  setViewerId: (viewerId: string) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const authUser = useAuthStore((state) => state.auth.user)
  const [delegatedTeams, setDelegatedTeams] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const managerId = authUser?.accountNo
    const isManager = authUser?.role[0] === 'manager'

    void listManagerDelegations().then((items) => {
      if (cancelled) return
      if (!managerId || !isManager) {
        setDelegatedTeams([])
        return
      }

      setDelegatedTeams(
        items
          .filter((item) => item.managerId === managerId && item.active)
          .map((item) => item.team)
      )
    })

    return () => {
      cancelled = true
    }
  }, [authUser])

  const setViewerId = useCallback((nextViewerId: string) => {
    if (import.meta.env.DEV) {
      // Viewer switching is intentionally disabled for the local auth gate.
      // Signing in as another seed user is the realistic permission test path.
      window.localStorage.setItem('flowpro.last-requested-viewer', nextViewerId)
    }
  }, [])

  const value = useMemo<SessionContextValue>(() => {
    const viewer: AppViewer = authUser
      ? {
          delegatedTeams,
          employeeId: authUser.accountNo,
          id: `viewer-${authUser.accountNo}`,
          managedTeam: authUser.team,
          name: authUser.name,
          role: authUser.role[0] ?? 'employee',
        }
      : defaultViewer

    return {
      availableViewers: [viewer],
      session: createLocalDevSession({
        displayName: viewer.name,
        employeeId: viewer.employeeId,
        role: viewer.role,
        team: viewer.managedTeam,
      }),
      setViewerId,
      viewer,
    }
  }, [authUser, delegatedTeams, setViewerId])

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession() {
  const session = useContext(SessionContext)

  if (!session) {
    throw new Error('useSession must be used within SessionProvider.')
  }

  return session
}
