import { Cross2Icon } from '@radix-ui/react-icons'
import { type ReactTable, type RowData } from '@tanstack/react-table'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import { type DataTableFeatures } from './features'
import { DataTableViewOptions } from './view-options'

type DataTableToolbarProps<TData extends RowData> = {
  table: ReactTable<DataTableFeatures, TData>
  searchPlaceholder?: string
  searchKey?: string
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }[]
  }[]
}

export function DataTableToolbar<TData extends RowData>({
  table,
  searchPlaceholder,
  searchKey,
  filters = [],
}: DataTableToolbarProps<TData>) {
  const { t } = useI18n()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.filter')
  const isFiltered =
    table.state.columnFilters.length > 0 || table.state.globalFilter

  return (
    <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex min-w-0 flex-1 flex-col-reverse items-start gap-2 sm:flex-row sm:items-center'>
        {searchKey ? (
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className='h-8 w-full sm:w-[180px] lg:w-[250px]'
          />
        ) : (
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={table.state.globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-full sm:w-[180px] lg:w-[250px]'
          />
        )}
        <div className='flex max-w-full gap-2 overflow-x-auto pb-1 sm:pb-0'>
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            if (!column) return null
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            )
          })}
        </div>
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
            className='h-8 px-2 lg:px-3'
          >
            {t('common.reset')}
            <Cross2Icon className='ms-2 h-4 w-4' />
          </Button>
        )}
      </div>
      <div className='flex justify-end'>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
