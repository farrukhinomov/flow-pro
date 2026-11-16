import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listWorkspaces, switchWorkspace } from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { loadWorkspaceSession } from '@/data/auth/account-session'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import {
  clearLocalWorkspaceData,
  flushUnsentChanges,
} from '@/data/auth/workspace-data'
import { useI18n } from '@/i18n'
import { Building2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { resetOnboardingGuard } from '@/features/onboarding/onboarding-guard'

/**
 * The workspaces of the signed-in account, as a group in the user menu. Shown only to people in
 * more than one, so everyone else sees no change.
 */
export function WorkspaceMenuGroup() {
  const { t } = useI18n()
  const [switching, setSwitching] = useState(false)
  const workspaces = useQuery({
    queryKey: ['account-workspaces'],
    queryFn: listWorkspaces,
    enabled: isSessionAuthEnabled(),
    staleTime: 60_000,
  })

  if (!workspaces.data || workspaces.data.length < 2) return null

  async function switchTo(tenantId: string) {
    setSwitching(true)
    const toastId = toast.loading(t('profileUi.switchingWorkspace'))

    try {
      // Local data is about to be cleared, so changes still waiting would be lost, or sent into
      // the new workspace. They go out first, or the switch waits.
      const unsent = await flushUnsentChanges()
      if (unsent > 0) {
        toast.error(
          t('profileUi.unsentChangesBlockSwitch', { count: unsent }),
          {
            id: toastId,
          }
        )
        return
      }

      await switchWorkspace(tenantId)
      await clearLocalWorkspaceData()
      await loadWorkspaceSession()
      resetOnboardingGuard()
      // A full load starts every screen, cache and sync loop fresh in the new workspace.
      window.location.assign('/')
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t, 'auth.error'), {
        id: toastId,
      })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
        {t('profileUi.workspaces')}
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        {workspaces.data.map((workspace) => (
          <DropdownMenuItem
            aria-current={workspace.isCurrent ? 'true' : undefined}
            disabled={switching}
            key={workspace.tenantId}
            onSelect={(event) => {
              if (workspace.isCurrent) return
              event.preventDefault()
              void switchTo(workspace.tenantId)
            }}
          >
            <Building2 />
            <span className='flex-1 truncate'>{workspace.name}</span>
            {workspace.isCurrent ? <Check className='ms-auto' /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </>
  )
}
