import type { ErrorComponentProps } from '@tanstack/react-router'
import { isFlowProApiError } from '@/data/api/api-error'
import { useI18n } from '@/i18n'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { logger } from '@/lib/logger'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for a single page.
 *
 * The application had exactly one boundary, at the router root, so any render
 * error in any widget replaced the entire application with a full-screen 500 —
 * including the navigation needed to get somewhere that still worked. This
 * renders inside the authenticated shell instead, so the sidebar, header, and
 * every other route stay usable while one page is broken.
 *
 * `reset` re-renders the failed subtree, which recovers the common case of a
 * transient load failure without a full page reload.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useI18n()

  logger.error(error, 'Route render failed')

  // Backend detail is English prose meant for operators. Showing it verbatim to
  // a German user is worse than the translated summary, so it is kept to
  // development where it speeds up diagnosis.
  const detail =
    import.meta.env.DEV && error instanceof Error ? error.message : undefined

  return (
    <div className='p-4'>
      <Alert variant='destructive'>
        <AlertTriangle className='h-4 w-4' />
        <AlertTitle>{t('errorsUi.routeErrorTitle')}</AlertTitle>
        <AlertDescription className='space-y-3'>
          <p>
            {isFlowProApiError(error)
              ? t('errorsUi.routeErrorDataDescription')
              : t('errorsUi.routeErrorDescription')}
          </p>
          {detail && (
            <pre className='max-w-full overflow-x-auto rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap'>
              {detail}
            </pre>
          )}
          <Button size='sm' variant='outline' onClick={reset}>
            <RefreshCcw className='h-4 w-4' />
            {t('errorsUi.tryAgain')}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
