import type { OutboxOperation } from '@/domain/attendance/types'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

/**
 * Detail view for one queued operation, including conflict resolution.
 *
 * Split out of `sync-status-popover.tsx`, which had grown to 772 lines. This is
 * the highest-stakes UI in the product - it is where a user decides whether the
 * local or the server version of a record wins - and it was buried inside a
 * popover that also owned the queue summary, the import/export controls, and a
 * loading skeleton.
 */

export function OperationInspector({
  t,
  onCancel,
  onOpenChange,
  onResolve,
  onRetry,
  operation,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string
  onCancel: (id: string) => void
  onOpenChange: (open: boolean) => void
  onResolve: (id: string, resolution: 'local-wins' | 'remote-wins') => void
  onRetry: (id: string) => void
  operation: OutboxOperation | null
}) {
  return (
    <Dialog open={!!operation} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('syncUi.operationDetails')}</DialogTitle>
          <DialogDescription>
            {t('syncUi.inspectQueuedChangesDescription')}
          </DialogDescription>
        </DialogHeader>

        {operation && (
          <div className='space-y-4'>
            <div className='grid gap-2 text-sm sm:grid-cols-2'>
              <InspectorLine label={t('syncUi.type')} value={operation.type} />
              <InspectorLine
                label={t('syncUi.status')}
                value={operation.status}
              />
              <InspectorLine
                label={t('syncUi.aggregate')}
                value={operation.aggregate}
              />
              <InspectorLine
                label={t('syncUi.record')}
                value={operation.aggregateId}
              />
              <InspectorLine
                label={t('syncUi.attempts')}
                value={String(operation.attemptCount)}
              />
              <InspectorLine
                label={t('syncUi.created')}
                value={new Date(operation.clientCreatedAt).toLocaleString()}
              />
            </div>

            {operation.conflict && (
              <div className='rounded-md border border-amber-200 bg-amber-500/10 p-3'>
                <div className='text-sm font-medium'>
                  {t('syncUi.conflict')}
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {operation.conflict.message}
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    onClick={() => onResolve(operation.id, 'local-wins')}
                  >
                    {t('syncUi.keepLocal')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => onResolve(operation.id, 'remote-wins')}
                  >
                    {t('syncUi.acceptRemote')}
                  </Button>
                </div>
              </div>
            )}

            {operation.lastError && (
              <div className='rounded-md border border-rose-200 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300'>
                {operation.lastError}
              </div>
            )}

            <ScrollArea className='h-56 rounded-md border bg-muted/20 p-3'>
              <pre className='text-xs whitespace-pre-wrap'>
                {JSON.stringify(operation.payload, null, 2)}
              </pre>
            </ScrollArea>

            <div className='flex justify-end gap-2'>
              {['failed', 'conflict', 'cancelled'].includes(
                operation.status
              ) && (
                <Button variant='outline' onClick={() => onRetry(operation.id)}>
                  {t('syncUi.retry')}
                </Button>
              )}
              {['pending', 'failed', 'conflict'].includes(operation.status) && (
                <CancelQueuedOperationButton
                  t={t}
                  destructive
                  onCancel={() => onCancel(operation.id)}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 font-mono text-xs break-all'>{value}</div>
    </div>
  )
}

export function CancelQueuedOperationButton({
  destructive = false,
  onCancel,
  t,
}: {
  destructive?: boolean
  onCancel: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={destructive ? 'destructive' : 'ghost'}
          size={destructive ? 'default' : 'sm'}
          className={
            destructive
              ? undefined
              : 'h-7 text-muted-foreground hover:text-rose-600'
          }
        >
          {destructive ? t('syncUi.cancelOperation') : t('syncUi.cancel')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('syncUi.cancelQueuedChangeQuestion')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('syncUi.cancelQueuedChangeDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('syncUi.keepQueuedChange')}</AlertDialogCancel>
          <AlertDialogAction
            className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
            onClick={onCancel}
          >
            {t('syncUi.cancelQueuedChange')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
