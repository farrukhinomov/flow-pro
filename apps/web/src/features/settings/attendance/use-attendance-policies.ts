import { useCallback, useEffect, useState } from 'react'
import { attendancePolicyWorkflow } from '@/application/attendance-policy-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import { listAttendanceTypes } from '@/data/local/attendance.repo'
import {
  readCurrentSyncMeta,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
  SyncMeta,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { optionalSource } from '@/lib/optional-source'

export function useAttendancePolicies() {
  const { t } = useI18n()
  const [types, setTypes] = useState<AttendanceStatusType[]>([])
  const [config, setConfig] = useState<AttendancePolicyConfig | null>(null)
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [nextTypes, nextConfig, nextSyncMeta] = await Promise.all([
        listAttendanceTypes(),
        getAttendancePolicyConfigBackendFirst(),
        optionalSource(readCurrentSyncMeta(), null, 'sync status'),
      ])

      setTypes(nextTypes)
      setConfig(nextConfig)
      setSyncMeta(nextSyncMeta)
    } catch (error) {
      logger.error(error, 'Could not load the attendance policy')
    } finally {
      setIsLoading(false)
    }
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

  const saveType = useCallback(
    async (type: AttendanceStatusType) => {
      try {
        await attendancePolicyWorkflow.saveType(type)
        await refresh()
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            t,
            'attendanceUi.unableToSaveAttendanceType'
          )
        )
      }
    },
    [refresh, t]
  )

  const deleteType = useCallback(
    async (id: string) => {
      try {
        await attendancePolicyWorkflow.deleteType(id)
        await refresh()
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            t,
            'attendanceUi.unableToDeleteAttendanceType'
          )
        )
      }
    },
    [refresh, t]
  )

  const saveConfig = useCallback(
    async (nextConfig: AttendancePolicyConfig) => {
      try {
        await attendancePolicyWorkflow.saveConfig(nextConfig)
        await refresh()
        toast.success(t('attendanceUi.attendancePolicyRulesSaved'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            t,
            'attendanceUi.unableToSaveAttendancePolicyRules'
          )
        )
      }
    },
    [refresh, t]
  )

  return {
    config,
    deleteType,
    isLoading,
    refresh,
    saveConfig,
    saveType,
    syncMeta,
    types,
  }
}
