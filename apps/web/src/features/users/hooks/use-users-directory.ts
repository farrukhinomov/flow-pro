import { useCallback, useEffect, useState } from 'react'
import { applicationStore } from '@/application/application-store'
import { organizationWorkflow } from '@/application/organization-workflow'
import { usersWorkflow } from '@/application/users-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { listOrganizationWorkspaceBackendFirst } from '@/data/organization.gateway'
import {
  readCurrentSyncMeta,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import type { SyncMeta } from '@/domain/attendance/types'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'

export function useUsersDirectory() {
  const { t } = useI18n()
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [delegationsByManager, setDelegationsByManager] = useState<
    Record<string, string[]>
  >({})
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [nextUsers, nextSyncMeta, organizationWorkspace] = await Promise.all([
      applicationStore.listUsers({
        onSnapshot: ({ data }) => setUsers(data),
      }),
      readCurrentSyncMeta(),
      listOrganizationWorkspaceBackendFirst(),
    ])

    setUsers(nextUsers)
    setSyncMeta(nextSyncMeta)
    setDelegationsByManager(
      organizationWorkspace.delegations.reduce<Record<string, string[]>>(
        (acc, item) => {
          if (!item.active) return acc
          acc[item.managerId] = [...(acc[item.managerId] ?? []), item.team]
          return acc
        },
        {}
      )
    )
    setIsLoading(false)
  }, [])

  useEffect(() => {
    startAttendanceAutoSync()
    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)
    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
    }
  }, [refresh])

  const saveUser = useCallback(
    async (user: EmployeeUser) => {
      try {
        await usersWorkflow.saveUser(user)
        await refresh()
        toast.success(t('usersUi.employeeSaved'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.unableSaveEmployee')
        )
      }
    },
    [refresh, t]
  )

  const deactivateUser = useCallback(
    async (user: EmployeeUser, reason?: string, actorId?: string) => {
      try {
        await usersWorkflow.deactivateUser({ actorId, reason, user })
        await refresh()
        toast.success(t('usersUi.employeeDeactivated'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.unableDeactivateEmployee')
        )
      }
    },
    [refresh, t]
  )

  const reactivateUser = useCallback(
    async (user: EmployeeUser) => {
      try {
        await usersWorkflow.reactivateUser(user)
        await refresh()
        toast.success(t('usersUi.employeeReactivated'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.unableReactivateEmployee')
        )
      }
    },
    [refresh, t]
  )

  const inviteUser = useCallback(
    async ({
      email,
      note,
      role,
    }: {
      email: string
      note?: string
      role: UserRole
    }) => {
      try {
        await usersWorkflow.inviteUser({ email, note, role })
        await refresh()
        toast.success(t('usersUi.invitationQueued'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.unableInviteEmployee')
        )
      }
    },
    [refresh, t]
  )

  return {
    delegationsByManager,
    deactivateUser,
    inviteUser,
    isLoading,
    reactivateUser,
    refresh,
    saveUser,
    syncMeta,
    users,
    setManagerDelegationTeams: async (managerId: string, teams: string[]) => {
      try {
        await organizationWorkflow.setManagerDelegations({ managerId, teams })
        await refresh()
        toast.success(t('usersUi.delegationUpdated'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.unableSaveDelegation')
        )
      }
    },
  }
}
