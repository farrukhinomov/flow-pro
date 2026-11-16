import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Card shell shared by the five catalog tables: header, create action, and the
 * archived/active badge. Split out of `organization-admin.tsx`.
 */
export function CatalogTableCard({
  actionLabel,
  canManage,
  children,
  description,
  onCreate,
  title,
}: {
  actionLabel?: string
  canManage: boolean
  children: React.ReactNode
  description: string
  onCreate?: () => void
  title: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {actionLabel ? (
          <Button disabled={!canManage} onClick={onCreate}>
            {actionLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function StatusBadge({ status }: { status: 'active' | 'archived' }) {
  const { t } = useI18n()
  return (
    <Badge variant='outline'>
      {status === 'active' ? t('usersUi.active') : t('usersUi.archived')}
    </Badge>
  )
}
