import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FlowProDrawerProps = {
  children: ReactNode
  description?: string
  footer?: ReactNode
  meta?: ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  status?: string
  title: string
}

export function FlowProDrawer({
  children,
  description,
  footer,
  meta,
  onOpenChange,
  open,
  status,
  title,
}: FlowProDrawerProps) {
  const { t } = useI18n()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        closeLabel={t('common.closePanel')}
        className='w-[92vw] gap-0 p-0 sm:max-w-xl'
      >
        <SheetHeader className='border-b text-start'>
          <div className='flex items-start justify-between gap-6 pe-8'>
            <div className='min-w-0'>
              <SheetTitle className='text-base'>{title}</SheetTitle>
              {description && (
                <SheetDescription className='mt-1'>
                  {description}
                </SheetDescription>
              )}
            </div>
            {status && (
              <Badge variant='outline' className='shrink-0'>
                {status}
              </Badge>
            )}
          </div>
          {meta && (
            <>
              <Separator className='my-2' />
              <div className='text-xs text-muted-foreground'>{meta}</div>
            </>
          )}
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-y-auto p-4'>{children}</div>

        <SheetFooter className='border-t bg-muted/20 sm:flex-row sm:justify-end'>
          {footer ?? (
            <>
              <SheetClose asChild>
                <Button variant='outline'>{t('common.close')}</Button>
              </SheetClose>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
