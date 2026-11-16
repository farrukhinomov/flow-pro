import { Link } from '@tanstack/react-router'
import type { EmployeeRequest } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { formatShortDate } from '@/i18n/format'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/flowpro/empty-state'
import { getStatusLabel } from '@/features/requests/request-view-model'
import {
  getRequestDetails,
  getRequestKindLabel,
  requestStatusStyles,
} from '../today-view-model'

export function OpenRequestsCard({
  requests,
}: {
  requests: EmployeeRequest[]
}) {
  const { locale, t } = useI18n()
  return (
    <Card>
      <CardHeader className='flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <CardTitle className='text-base'>
            {t('todayUi.openRequests')}
          </CardTitle>
          <CardDescription>
            {t('todayUi.openRequestsDescription')}
          </CardDescription>
        </div>
        <Button variant='outline' size='sm' asChild>
          <Link to='/requests' search={{ kind: undefined }}>
            {t('todayUi.viewAll')}
            <ArrowRight className='h-4 w-4' />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='min-w-0'>
          <Table containerClassName='max-h-80 overflow-auto'>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                <TableHead className='w-28'>{t('requestsUi.date')}</TableHead>
                <TableHead>{t('requestsUi.type')}</TableHead>
                <TableHead>{t('requestsUi.details')}</TableHead>
                <TableHead className='w-32'>{t('requestsUi.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='p-4'>
                    <EmptyState
                      className='min-h-40 border-0 bg-transparent'
                      title={t('todayUi.noOpenRequests')}
                      description={t('todayUi.noOpenRequestsDescription')}
                      action={{
                        label: t('todayUi.createRequest'),
                        onClick: () => {
                          window.location.assign('/requests')
                        },
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request, index) => (
                  <TableRow
                    key={request.id}
                    className={cn(index % 2 === 1 && 'bg-muted/20')}
                  >
                    <TableCell className='font-mono text-sm text-muted-foreground'>
                      {formatShortDate(request.submittedAt, locale)}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {getRequestKindLabel(request.kind, t)}
                    </TableCell>
                    <TableCell className='max-w-[320px] text-sm whitespace-normal text-muted-foreground'>
                      {getRequestDetails(request, t, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn(
                          'text-xs capitalize',
                          requestStatusStyles[request.status]
                        )}
                      >
                        {getStatusLabel(request.status, t)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
