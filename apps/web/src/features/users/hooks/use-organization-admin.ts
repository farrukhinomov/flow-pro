import { useCallback, useEffect, useMemo, useState } from 'react'
import { organizationWorkflow } from '@/application/organization-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { listEmployeeUsers } from '@/data/local/users.repo'
import { listOrganizationWorkspaceBackendFirst } from '@/data/organization.gateway'
import {
  readCurrentSyncMeta,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import type { SyncMeta } from '@/domain/attendance/types'
import type {
  DepartmentCatalog,
  LocationCatalog,
  OrganizationCatalogRecord,
  RoleProfile,
  TeamCatalog,
  WorkPatternCatalog,
} from '@/domain/organization/types'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { optionalSource } from '@/lib/optional-source'

export function useOrganizationAdmin() {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [catalog, setCatalog] = useState<OrganizationCatalogRecord[]>([])
  const [delegationsByManager, setDelegationsByManager] = useState<
    Record<string, string[]>
  >({})

  const refresh = useCallback(async () => {
    try {
      const [nextUsers, organizationWorkspace, nextSyncMeta] =
        await Promise.all([
          optionalSource(
            listEmployeeUsersBackendFirst(),
            () => listEmployeeUsers(),
            'people'
          ),
          listOrganizationWorkspaceBackendFirst(),
          optionalSource(readCurrentSyncMeta(), null, 'sync status'),
        ])

      setUsers(nextUsers)
      setCatalog(organizationWorkspace.records)
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
    } catch (error) {
      logger.error(error, 'Could not load the organization catalog')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startAttendanceAutoSync()
    const runRefresh = () => void refresh()
    const timer = window.setTimeout(runRefresh, 0)
    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [refresh])

  const roleProfiles = useMemo(
    () =>
      catalog
        .filter((item): item is RoleProfile => item.kind === 'role-profile')
        .sort((left, right) => left.label.localeCompare(right.label)),
    [catalog]
  )
  const departments = useMemo(
    () =>
      catalog
        .filter((item): item is DepartmentCatalog => item.kind === 'department')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [catalog]
  )
  const locations = useMemo(
    () =>
      catalog
        .filter((item): item is LocationCatalog => item.kind === 'location')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [catalog]
  )
  const teams = useMemo(
    () =>
      catalog
        .filter((item): item is TeamCatalog => item.kind === 'team')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [catalog]
  )
  const workPatterns = useMemo(
    () =>
      catalog
        .filter(
          (item): item is WorkPatternCatalog => item.kind === 'work-pattern'
        )
        .sort((left, right) => left.label.localeCompare(right.label)),
    [catalog]
  )
  const managers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.status === 'active' &&
          (user.role === 'manager' ||
            user.role === 'admin' ||
            user.role === 'superadmin')
      ),
    [users]
  )

  const saveRecord = useCallback(
    async (record: OrganizationCatalogRecord) => {
      try {
        await organizationWorkflow.saveRecord(record)
        await refresh()
        toast.success(t('usersUi.organizationSaved'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'usersUi.organizationSaveFailed')
        )
      }
    },
    [refresh, t]
  )

  const setManagerTeams = useCallback(
    async (managerId: string, teams: string[]) => {
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
    [refresh, t]
  )

  return {
    delegationsByManager,
    departments,
    isLoading,
    locations,
    managers,
    refresh,
    roleProfiles,
    saveRecord,
    setManagerTeams,
    syncMeta,
    teams,
    users,
    workPatterns,
  }
}
