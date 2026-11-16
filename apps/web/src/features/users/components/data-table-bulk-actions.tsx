import { type ReactTable } from '@tanstack/react-table'
import { useI18n } from '@/i18n'
import { UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DataTableBulkActions as BulkActionsToolbar,
  type DataTableFeatures,
} from '@/components/data-table'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

type DataTableBulkActionsProps = {
  table: ReactTable<DataTableFeatures, User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useI18n()
  const { deactivateUser, reactivateUser } = useUsers()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
    const selectedUsers = selectedRows.map((row) => row.original)

    if (status === 'active') {
      await Promise.all(
        selectedUsers
          .filter((user) => user.status === 'inactive')
          .map((user) => reactivateUser(user))
      )
      toast.success(
        t('usersUi.reactivatedSelectedUsers', {
          count: String(selectedUsers.length),
        })
      )
    } else {
      await Promise.all(
        selectedUsers
          .filter((user) => user.status !== 'inactive')
          .map((user) =>
            deactivateUser(user, t('usersUi.bulkDeactivationReason'))
          )
      )
      toast.success(
        t('usersUi.deactivatedSelectedUsers', {
          count: String(selectedUsers.length),
        })
      )
    }

    table.resetRowSelection()
  }

  const handleBulkInvite = () => {
    const selectedUsers = selectedRows.map((row) => row.original)
    toast.promise(sleep(2000), {
      loading: t('usersUi.invitingUsers'),
      success: () => {
        table.resetRowSelection()
        return t('usersUi.invitedUsersCount', {
          count: String(selectedUsers.length),
        })
      },
      error: t('usersUi.errorInvitingUsers'),
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleBulkInvite}
              className='size-8'
              aria-label={t('usersUi.inviteSelectedUsers')}
              title={t('usersUi.inviteSelectedUsers')}
            >
              <Mail />
              <span className='sr-only'>
                {t('usersUi.inviteSelectedUsers')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('usersUi.inviteSelectedUsers')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => void handleBulkStatusChange('active')}
              className='size-8'
              aria-label={t('usersUi.activateSelectedUsers')}
              title={t('usersUi.activateSelectedUsers')}
            >
              <UserCheck />
              <span className='sr-only'>
                {t('usersUi.activateSelectedUsers')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('usersUi.activateSelectedUsers')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => void handleBulkStatusChange('inactive')}
              className='size-8'
              aria-label={t('usersUi.deactivateSelectedUsers')}
              title={t('usersUi.deactivateSelectedUsers')}
            >
              <UserX />
              <span className='sr-only'>
                {t('usersUi.deactivateSelectedUsers')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('usersUi.deactivateSelectedUsers')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>
    </>
  )
}
