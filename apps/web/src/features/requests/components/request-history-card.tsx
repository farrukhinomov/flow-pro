import { useI18n } from '@/i18n'
import { Search } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { RequestRow } from '../request-view-model'
import { RequestTable } from './request-table'

export function RequestHistoryCard({
  isLoading,
  onSearchChange,
  rows,
  search,
}: {
  isLoading?: boolean
  onSearchChange: (value: string) => void
  rows: RequestRow[]
  search: string
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <CardTitle className='text-base'>
              {t('requestsUi.historyTitle')}
            </CardTitle>
            <CardDescription>{t('requestsUi.historySubtitle')}</CardDescription>
          </div>
          <div className='relative w-full sm:w-72'>
            <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('requestsUi.searchRequests')}
              className='pl-8'
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <RequestTable
          rows={rows}
          isLoading={isLoading}
          showOwner
          embedded
          emptyAction={
            search
              ? {
                  label: t('requestsUi.clearSearch'),
                  onClick: () => onSearchChange(''),
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
}
