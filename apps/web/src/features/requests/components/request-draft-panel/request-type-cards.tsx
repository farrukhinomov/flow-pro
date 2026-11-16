import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { RequestKind } from '../../request-view-model'
import { requestKindOptions } from './request-kind-options'

export function RequestTypeCards({
  kind,
  onSelect,
}: {
  kind: RequestKind
  onSelect: (kind: RequestKind) => void
}) {
  const { t } = useI18n()
  return (
    <div className='space-y-2'>
      {requestKindOptions.map(
        ({ value, titleKey, descriptionKey, icon: Icon }) => (
          <button
            key={value}
            type='button'
            onClick={() => onSelect(value)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              kind === value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/60'
            )}
          >
            <div className='flex items-start gap-3'>
              <Icon className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
              <div>
                <div className='text-sm font-medium'>{t(titleKey)}</div>
                <div className='mt-1 text-xs leading-5 text-muted-foreground'>
                  {t(descriptionKey)}
                </div>
              </div>
            </div>
          </button>
        )
      )}
    </div>
  )
}
