import { useRef, useState } from 'react'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import type { OutboxOperation } from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { formatRelativeTime } from '@/i18n/format'
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CancelQueuedOperationButton,
  OperationInspector,
} from './sync-operation-inspector'
import {
  operationDescription,
  operationStatusLabel,
  operationTitle,
} from './sync-operation-labels'
import { SyncPopoverSkeleton } from './sync-popover-skeleton'
import { useSyncStatus } from './use-sync-status'

export function SyncStatusPopover() {
  const { locale, t } = useI18n()
  const [selectedOperation, setSelectedOperation] =
    useState<OutboxOperation | null>(null)
  const {
    cancelOperation,
    failedOperations,
    exportLocalData,
    importLocalData,
    isExporting,
    isImporting,
    isLoading,
    isRetrying,
    migrationStatus,
    pendingOperations,
    resolveConflict,
    resetLocalData,
    retry,
    retryOperation,
    storeCounts,
    syncMeta,
  } = useSyncStatus()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const hasFailures = failedOperations.length > 0 || !!syncMeta?.lastError
  const hasConflicts = pendingOperations.some(
    (operation) => operation.status === 'conflict'
  )
  const hasPending = (syncMeta?.pendingCount ?? 0) > 0
  const isOffline = syncMeta?.isOnline === false
  const Icon = isOffline ? CloudOff : hasFailures ? AlertTriangle : CheckCircle2

  const handleExport = async () => {
    try {
      await exportLocalData()
      toast.success(t('syncUi.exportSuccess'))
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t, 'syncUi.exportError'))
    }
  }

  const handleImport = async (file: File) => {
    try {
      await importLocalData(file)
      toast.success(t('syncUi.importSuccess'))
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t, 'syncUi.importError'))
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className={cn(
                  'relative h-8 w-8',
                  hasFailures && 'border-amber-300 text-amber-600',
                  isOffline && 'border-rose-300 text-rose-600'
                )}
                aria-label={t('syncUi.openSyncStatus')}
              >
                {isLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Icon className='h-4 w-4' />
                )}
                {hasPending && (
                  <span className='absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground'>
                    {syncMeta?.pendingCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('syncUi.syncStatus')}</TooltipContent>
        </Tooltip>

        <PopoverContent
          align='end'
          className='max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:w-96'
        >
          {isLoading ? (
            <SyncPopoverSkeleton />
          ) : (
            <>
              <div className='p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <div className='font-medium'>{t('syncUi.localSync')}</div>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      {t('syncUi.queueHealthDescription')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      isOffline || hasFailures || hasConflicts
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {isOffline
                      ? t('syncUi.offline')
                      : hasConflicts
                        ? t('syncUi.conflict')
                        : hasFailures
                          ? t('syncUi.needsRetry')
                          : t('syncUi.healthy')}
                  </Badge>
                </div>

                <div className='mt-4 grid grid-cols-3 gap-2 text-sm'>
                  <Metric
                    label={t('syncUi.pending')}
                    value={syncMeta?.pendingCount ?? 0}
                  />
                  <Metric
                    label={t('syncUi.failed')}
                    value={failedOperations.length}
                  />
                  <Metric
                    label={t('syncUi.online')}
                    value={
                      syncMeta?.isOnline === false
                        ? t('syncUi.no')
                        : t('syncUi.yes')
                    }
                  />
                </div>

                {(isOffline || hasPending || hasFailures) && (
                  <div className='mt-3 rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground'>
                    {isOffline
                      ? t('syncUi.offlineQueueHint')
                      : hasFailures
                        ? t('syncUi.failedQueueHint')
                        : t('syncUi.pendingQueueHint')}
                  </div>
                )}

                <div className='mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground'>
                  <span>
                    {t('syncUi.lastSync')}{' '}
                    {syncMeta?.lastSyncedAt
                      ? formatRelativeTime(syncMeta.lastSyncedAt, locale)
                      : t('syncUi.notSyncedYet')}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-8 gap-2'
                    onClick={() => void retry()}
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <RefreshCcw className='h-3.5 w-3.5' />
                    )}
                    {t('syncUi.retry')}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className='p-4'>
                <div className='mb-3 flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 text-sm font-medium'>
                    <Database className='h-4 w-4 text-muted-foreground' />
                    {t('syncUi.localData')}
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      ref={importInputRef}
                      type='file'
                      accept='application/json,.json'
                      className='hidden'
                      onChange={(event) => {
                        const file = event.target.files?.[0]

                        if (file) void handleImport(file)
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          aria-label={t('syncUi.exportLocalData')}
                          disabled={isExporting}
                          onClick={() => void handleExport()}
                        >
                          {isExporting ? (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          ) : (
                            <Download className='h-3.5 w-3.5' />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('syncUi.exportLocalData')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          aria-label={t('syncUi.importLocalData')}
                          disabled={isImporting}
                          onClick={() => importInputRef.current?.click()}
                        >
                          {isImporting ? (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          ) : (
                            <Upload className='h-3.5 w-3.5' />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('syncUi.importLocalData')}
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                          <span className='sr-only'>
                            {t('syncUi.resetLocalData')}
                          </span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('syncUi.resetLocalFlowProDataQuestion')}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('syncUi.resetLocalDataDescription')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t('syncUi.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
                            onClick={() => void resetLocalData()}
                          >
                            {t('syncUi.resetLocalData')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  {storeCounts &&
                    Object.entries(storeCounts).map(([storeName, count]) => (
                      <div
                        key={storeName}
                        className='flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5 text-xs'
                      >
                        <span className='truncate text-muted-foreground'>
                          {storeName}
                        </span>
                        <span className='font-mono font-semibold'>{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              <Separator />

              {migrationStatus && (
                <>
                  <div className='p-4'>
                    <div className='mb-2 flex items-center justify-between gap-3'>
                      <div className='text-sm font-medium'>
                        {t('syncUi.schemaMigration')}
                      </div>
                      <Badge
                        variant={
                          migrationStatus.needsReload ? 'secondary' : 'outline'
                        }
                      >
                        v{migrationStatus.currentVersion}
                      </Badge>
                    </div>
                    <div className='space-y-2'>
                      {migrationStatus.notes.map((note) => (
                        <div
                          key={note.version}
                          className='rounded-md border p-2'
                        >
                          <div className='text-xs font-medium'>
                            v{note.version} · {note.title}
                          </div>
                          <div className='mt-1 text-xs text-muted-foreground'>
                            {note.description}
                          </div>
                        </div>
                      ))}
                    </div>
                    {migrationStatus.lastUpgrade && (
                      <div className='mt-2 text-xs text-muted-foreground'>
                        {t('syncUi.upgradedFromToSession', {
                          fromVersion: migrationStatus.lastUpgrade.fromVersion,
                          toVersion: migrationStatus.lastUpgrade.toVersion,
                        })}
                      </div>
                    )}
                  </div>

                  <Separator />
                </>
              )}

              <ScrollArea className='max-h-72'>
                <div className='space-y-2 p-4'>
                  {pendingOperations.length === 0 ? (
                    <div className='rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground'>
                      {t('syncUi.noQueuedLocalChanges')}
                    </div>
                  ) : (
                    pendingOperations.slice(0, 8).map((operation) => (
                      <div key={operation.id} className='rounded-md border p-3'>
                        <div className='flex items-center justify-between gap-2'>
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-medium'>
                              {operationTitle(operation, t)}
                            </div>
                            <div className='mt-1 text-xs text-muted-foreground'>
                              {operationDescription(operation, t)}
                            </div>
                          </div>
                          <Badge variant='outline'>
                            {operationStatusLabel(operation.status, t)}
                          </Badge>
                        </div>
                        <div className='mt-1 text-xs text-muted-foreground'>
                          {t('syncUi.queuedRecordHint', {
                            record: operation.aggregateId,
                          })}
                        </div>
                        {operation.lastError && (
                          <div className='mt-2 text-xs text-amber-600'>
                            {operation.lastError}
                          </div>
                        )}
                        <div className='mt-3 flex flex-wrap justify-end gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            className='h-7 gap-1.5'
                            onClick={() => setSelectedOperation(operation)}
                          >
                            <Search className='h-3.5 w-3.5' />
                            {t('syncUi.details')}
                          </Button>
                          {['failed', 'conflict', 'cancelled'].includes(
                            operation.status
                          ) && (
                            <Button
                              variant='outline'
                              size='sm'
                              className='h-7'
                              onClick={() => void retryOperation(operation.id)}
                            >
                              {t('syncUi.retry')}
                            </Button>
                          )}
                          {['pending', 'failed', 'conflict'].includes(
                            operation.status
                          ) && (
                            <CancelQueuedOperationButton
                              t={t}
                              onCancel={() =>
                                void cancelOperation(operation.id)
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </PopoverContent>
      </Popover>

      <OperationInspector
        t={t}
        operation={selectedOperation}
        onOpenChange={(open) => {
          if (!open) setSelectedOperation(null)
        }}
        onCancel={(id) => void cancelOperation(id)}
        onRetry={(id) => void retryOperation(id)}
        onResolve={(id, resolution) => void resolveConflict(id, resolution)}
      />
    </>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className='rounded-md border bg-muted/20 p-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 font-mono text-lg font-semibold'>{value}</div>
    </div>
  )
}
