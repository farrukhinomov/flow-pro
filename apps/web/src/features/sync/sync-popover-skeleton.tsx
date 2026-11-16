import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

/** Loading placeholder for the sync popover, matching its real layout. */
export function SyncPopoverSkeleton() {
  return (
    <>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-2'>
            <Skeleton className='h-5 w-28' />
            <Skeleton className='h-4 w-56' />
          </div>
          <Skeleton className='h-6 w-20' />
        </div>

        <div className='mt-4 grid grid-cols-3 gap-2'>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className='rounded-md border bg-muted/20 p-2'>
              <Skeleton className='h-3 w-14' />
              <Skeleton className='mt-2 h-7 w-12' />
            </div>
          ))}
        </div>

        <div className='mt-4 flex items-center justify-between gap-3'>
          <Skeleton className='h-4 w-36' />
          <Skeleton className='h-8 w-20' />
        </div>
      </div>

      <Separator />

      <div className='p-4'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <Skeleton className='h-5 w-24' />
          <div className='flex items-center gap-2'>
            <Skeleton className='h-8 w-8' />
            <Skeleton className='h-8 w-8' />
            <Skeleton className='h-8 w-8' />
          </div>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className='flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5'
            >
              <Skeleton className='h-3 w-20' />
              <Skeleton className='h-4 w-8' />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className='space-y-2 p-4'>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className='rounded-md border p-3'>
            <div className='flex items-center justify-between gap-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-5 w-16' />
            </div>
            <Skeleton className='mt-2 h-3 w-32' />
            <div className='mt-3 flex justify-end gap-2'>
              <Skeleton className='h-7 w-16' />
              <Skeleton className='h-7 w-14' />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
