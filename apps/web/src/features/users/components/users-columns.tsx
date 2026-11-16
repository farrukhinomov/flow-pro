import { type ColumnDef } from '@tanstack/react-table'
import type { RoleProfile } from '@/domain/organization/types'
import { getLifecycleSummary } from '@/domain/users/lifecycle'
import type { Locale } from '@/i18n'
import { formatRelativeTime, formatShortDate } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DataTableColumnHeader,
  type DataTableFeatures,
} from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { callTypes, roles } from '../data/data'
import { type User } from '../data/schema'
import { translateLifecycleSummary } from '../users-view-model'
import { DataTableRowActions } from './data-table-row-actions'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function getUsersColumns(
  t: Translate,
  roleProfiles: RoleProfile[],
  locale: Locale
): ColumnDef<DataTableFeatures, User>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('usersUi.selectAllRows')}
          className='translate-y-[2px]'
        />
      ),
      meta: {
        className: cn('max-md:sticky start-0 z-10 rounded-tl-[inherit]'),
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('usersUi.selectRow')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.person')} />
      ),
      cell: ({ row }) => (
        <div className='flex items-center gap-3 ps-3'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold'>
            {getInitials(row.original.firstName, row.original.lastName)}
          </div>
          <div className='min-w-0'>
            <LongText className='max-w-40 font-medium'>
              {row.original.firstName} {row.original.lastName}
            </LongText>
            <LongText className='max-w-40 text-xs text-muted-foreground'>
              @{row.getValue('username')}
            </LongText>
          </div>
        </div>
      ),
      meta: {
        className: cn(
          'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
          'ps-0.5 max-md:sticky start-6 @4xl/content:table-cell @4xl/content:drop-shadow-none'
        ),
      },
      enableHiding: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.contact')} />
      ),
      cell: ({ row }) => (
        <div className='space-y-1 ps-2'>
          <LongText className='max-w-52 text-sm'>
            {row.getValue('email')}
          </LongText>
          <div className='text-xs text-muted-foreground'>
            {row.original.phoneNumber}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'team',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.team')} />
      ),
      cell: ({ row }) => (
        <div className='space-y-1'>
          <div className='text-sm font-medium'>{row.getValue('team')}</div>
          <div className='text-xs text-muted-foreground'>
            {t('usersUi.manager')}: {row.original.manager}
          </div>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.status')} />
      ),
      cell: ({ row }) => {
        const { status } = row.original
        const badgeColor = callTypes.get(status)
        return (
          <div className='flex space-x-2'>
            <Badge variant='outline' className={cn('capitalize', badgeColor)}>
              {row.getValue('status')}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.role')} />
      ),
      cell: ({ row }) => {
        const { role } = row.original
        const userType = roles.find(({ value }) => value === role)
        const roleProfileLabel = roleProfiles.find(
          (profile) => profile.id === row.original.roleProfileId
        )?.label

        if (!userType) {
          return null
        }

        return (
          <div className='flex items-center gap-x-2'>
            {userType.icon && (
              <userType.icon size={16} className='text-muted-foreground' />
            )}
            <span className='text-sm capitalize'>
              {roleProfileLabel ?? row.getValue('role')}
            </span>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'workPattern',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usersUi.workPattern')}
        />
      ),
      cell: ({ row }) => (
        <div className='space-y-1'>
          <div className='text-sm'>{row.original.workPattern}</div>
          <LongText className='max-w-48 text-xs text-muted-foreground'>
            {row.original.visibilityScope}
          </LongText>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'lastSeenAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('usersUi.activity')} />
      ),
      cell: ({ row }) => (
        <div className='space-y-1 text-sm'>
          <div>
            {row.original.lastSeenAt
              ? formatRelativeTime(row.original.lastSeenAt, locale)
              : t('usersUi.invitationPending')}
          </div>
          <div className='text-xs text-muted-foreground'>
            {row.original.status === 'inactive'
              ? translateLifecycleSummary(
                  getLifecycleSummary(row.original),
                  locale,
                  t
                )
              : t('usersUi.reviewDate', {
                  date: row.original.nextReviewAt
                    ? formatShortDate(row.original.nextReviewAt, locale)
                    : '-',
                })}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      cell: DataTableRowActions,
    },
  ]
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}
