import { useCallback, useEffect, useState } from 'react'
import { listOutboxOperations } from '@/data/local/attendance.repo'
import {
  exportFlowProLocalData,
  getStoreCounts,
  getMigrationStatus,
  importFlowProLocalData,
  resetFlowProLocalDatabase,
  type StoreName,
} from '@/data/local/db'
import {
  readCurrentSyncMeta,
  cancelOutboxOperation,
  resolveOutboxConflict,
  retryOutboxOperation,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type { OutboxOperation, SyncMeta } from '@/domain/attendance/types'
import { downloadJsonFile } from '@/lib/download'

export function useSyncStatus() {
  const [operations, setOperations] = useState<OutboxOperation[]>([])
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [storeCounts, setStoreCounts] = useState<Record<
    StoreName,
    number
  > | null>(null)
  const [migrationStatus, setMigrationStatus] = useState<Awaited<
    ReturnType<typeof getMigrationStatus>
  > | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)

  const refresh = useCallback(async () => {
    const [nextOperations, nextSyncMeta, nextStoreCounts, nextMigrationStatus] =
      await Promise.all([
        listOutboxOperations(),
        readCurrentSyncMeta(),
        getStoreCounts(),
        getMigrationStatus(),
      ])

    setOperations(nextOperations)
    setSyncMeta(nextSyncMeta)
    setStoreCounts(nextStoreCounts)
    setMigrationStatus(nextMigrationStatus)
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

  const retry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await syncAttendanceOutbox()
      await refresh()
    } finally {
      setIsRetrying(false)
    }
  }, [refresh])

  const retryOperation = useCallback(
    async (operationId: string) => {
      await retryOutboxOperation(operationId)
      await refresh()
    },
    [refresh]
  )

  const cancelOperation = useCallback(
    async (operationId: string) => {
      await cancelOutboxOperation(operationId)
      await refresh()
    },
    [refresh]
  )

  const resolveConflict = useCallback(
    async (operationId: string, resolution: 'local-wins' | 'remote-wins') => {
      await resolveOutboxConflict(operationId, resolution)
      await refresh()
    },
    [refresh]
  )

  const resetLocalData = useCallback(async () => {
    await resetFlowProLocalDatabase()
    window.location.reload()
  }, [])

  const exportLocalData = useCallback(async () => {
    setIsExporting(true)
    try {
      const payload = await exportFlowProLocalData()

      downloadJsonFile(
        `flowpro-local-data-${new Date().toISOString().slice(0, 10)}.json`,
        payload
      )
    } finally {
      setIsExporting(false)
    }
  }, [])

  const importLocalData = useCallback(
    async (file: File) => {
      setIsImporting(true)
      try {
        const payload = JSON.parse(await file.text())
        await importFlowProLocalData(payload)
        await refresh()
      } finally {
        setIsImporting(false)
      }
    },
    [refresh]
  )

  return {
    exportLocalData,
    failedOperations: operations.filter(
      (operation) => operation.status === 'failed'
    ),
    importLocalData,
    isExporting,
    isImporting,
    isLoading,
    isRetrying,
    migrationStatus,
    operations,
    pendingOperations: operations.filter((operation) =>
      ['pending', 'syncing', 'failed', 'conflict'].includes(operation.status)
    ),
    cancelOperation,
    resolveConflict,
    resetLocalData,
    retry,
    retryOperation,
    storeCounts,
    syncMeta,
  }
}
