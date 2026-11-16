import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

export function MetricCardsSkeleton({
  cardCount = 4,
  className,
}: {
  cardCount?: number
  className?: string
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: cardCount }, (_, index) => (
        <Card key={index}>
          <CardContent className='flex items-center gap-4 p-4'>
            <Skeleton className='h-10 w-10 shrink-0 rounded-md' />
            <div className='min-w-0 flex-1 space-y-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-8 w-20' />
              <Skeleton className='h-3 w-32' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TableBodySkeletonRows({
  columns,
  rows = 6,
}: {
  columns: number
  rows?: number
}) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <TableRow key={rowIndex}>
      <TableCell colSpan={columns}>
        <div className='grid gap-2 py-1'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
        </div>
      </TableCell>
    </TableRow>
  ))
}

export function CardSectionSkeleton({
  blocks = 3,
  className,
}: {
  blocks?: number
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className='space-y-2'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-4 w-72 max-w-full' />
      </CardHeader>
      <CardContent className='space-y-3'>
        {Array.from({ length: blocks }, (_, index) => (
          <div key={index} className='rounded-md border p-3'>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-3 w-full' />
              <Skeleton className='h-3 w-5/6' />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function FilterBarSkeleton({
  showSearch = true,
  filters = 2,
  className,
}: {
  showSearch?: boolean
  filters?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center'>
        {showSearch && <Skeleton className='h-10 w-full sm:w-72' />}
        {Array.from({ length: filters }, (_, index) => (
          <Skeleton key={index} className='h-10 w-full sm:w-48' />
        ))}
      </div>
    </div>
  )
}

export function TabsListSkeleton({
  items = 4,
  widths,
  className,
}: {
  items?: number
  widths?: string[]
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className='flex w-max min-w-max gap-2'>
        {Array.from({ length: items }, (_, index) => (
          <Skeleton
            key={index}
            className={cn('h-10 rounded-md', widths?.[index] ?? 'w-28')}
          />
        ))}
      </div>
    </div>
  )
}

export function DrawerPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className='space-y-3 rounded-md border p-4'>
      <div className='space-y-2'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-4 w-64 max-w-full' />
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DrawerTimelineSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className='space-y-3'>
      <Skeleton className='h-5 w-32' />
      <div className='space-y-2'>
        {Array.from({ length: items }, (_, index) => (
          <div key={index} className='rounded-md border p-3'>
            <div className='flex items-center justify-between gap-3'>
              <Skeleton className='h-4 w-48 max-w-[70%]' />
              <Skeleton className='h-4 w-20' />
            </div>
            <Skeleton className='mt-2 h-3 w-32' />
          </div>
        ))}
      </div>
    </div>
  )
}
