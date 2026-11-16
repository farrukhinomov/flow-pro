import { useEffect, useState } from 'react'
import {
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { EmptyState } from '@/components/flowpro/empty-state'
import { LiveRegion } from '@/components/live-region'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { getUsersColumns } from './users-columns'
import { useUsers } from './users-provider'

type DataTableProps = {
  data: User[]
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function UsersTable({ data, search, navigate }: DataTableProps) {
  const { locale, t } = useI18n()
  const { roleProfiles } = useUsers()
  const columns = getUsersColumns(t, roleProfiles, locale)
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  // Local state management for table (uncomment to use local-only state, not synced with URL)
  // const [columnFilters, onColumnFiltersChange] = useState<ColumnFiltersState>([])
  // const [pagination, onPaginationChange] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  // Synced with URL states (keys/defaults mirror users route search schema)
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      // username per-column text filter
      { columnId: 'username', searchKey: 'username', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
    ],
  })

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    onPaginationChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16', // Add margin bottom to the table on mobile when the toolbar is visible
        'flex min-h-0 flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder={t('usersUi.filterUsers')}
        searchKey='username'
        filters={[
          {
            columnId: 'status',
            title: t('requestsUi.status'),
            options: [
              { label: t('usersUi.active'), value: 'active' },
              { label: t('usersUi.inactive'), value: 'inactive' },
              { label: t('usersUi.invited'), value: 'invited' },
              { label: t('usersUi.suspended'), value: 'suspended' },
            ],
          },
          {
            columnId: 'role',
            title: t('settings.account.role'),
            options: roles.map((role) => ({ ...role })),
          },
        ]}
      />
      {/* Toolbar filters rewrite the rows below without moving focus. */}
      <LiveRegion
        message={t('common.resultsAnnouncement', {
          count: table.getFilteredRowModel().rows.length,
        })}
      />
      <div className='min-h-0 overflow-hidden rounded-md border'>
        <Table containerClassName='max-h-[68svh] min-h-72 overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='p-4'>
                  <EmptyState
                    className='min-h-56 border-0 bg-transparent'
                    title={t('usersUi.noEmployeesMatch')}
                    description={t('usersUi.noEmployeesMatchDescription')}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} />
    </div>
  )
}
