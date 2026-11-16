import { useI18n } from '@/i18n'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function EmptyState({
  action,
  className,
  description,
  icon: Icon,
  title,
}: {
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  description: string
  icon?: LucideIcon
  title: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center rounded-md border bg-muted/20 p-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-md border bg-background text-muted-foreground'>
          <Icon className='h-4 w-4' />
        </div>
      )}
      <div className='text-sm font-medium'>{title}</div>
      <p className='mt-1 max-w-md text-sm text-muted-foreground'>
        {description}
      </p>
      {action && (
        <Button className='mt-4' size='sm' onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function LoadingState({
  className,
  description,
  title,
}: {
  className?: string
  description?: string
  title: string
}) {
  const { t } = useI18n()
  const resolvedDescription =
    description ?? t('common.preparingLatestLocalData')

  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center rounded-md border bg-muted/20 p-6 text-center',
        className
      )}
    >
      <Loader2 className='mb-3 h-5 w-5 animate-spin text-muted-foreground' />
      <div className='text-sm font-medium'>{title}</div>
      <p className='mt-1 max-w-md text-sm text-muted-foreground'>
        {resolvedDescription}
      </p>
    </div>
  )
}
