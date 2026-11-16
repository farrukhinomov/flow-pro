import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { resendInvitation } from '@/data/api/users.api'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import { MailPlus, UserCheck, UserPen, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type DataTableFeatures } from '@/components/data-table'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

type DataTableRowActionsProps = {
  row: Row<DataTableFeatures, User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useI18n()
  const { reactivateUser, setOpen, setCurrentRow } = useUsers()
  const isInactive = row.original.status === 'inactive'
  // Only an instance with real sign-in sends invitation links.
  const canResendInvitation =
    row.original.status === 'invited' && isSessionAuthEnabled()

  async function resend() {
    try {
      await resendInvitation(row.original.id)
      toast.success(
        t('usersUi.invitationResent', { email: row.original.email })
      )
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t, 'auth.error'))
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
          >
            <DotsHorizontalIcon className='h-4 w-4' />
            <span className='sr-only'>{t('usersUi.openMenu')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[160px]'>
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(row.original)
              setOpen('edit')
            }}
          >
            {t('requestsUi.edit')}
            <DropdownMenuShortcut>
              <UserPen size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          {canResendInvitation ? (
            <DropdownMenuItem onClick={() => void resend()}>
              {t('usersUi.resendInvitation')}
              <DropdownMenuShortcut>
                <MailPlus size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {isInactive ? (
            <DropdownMenuItem onClick={() => void reactivateUser(row.original)}>
              {t('usersUi.reactivate')}
              <DropdownMenuShortcut>
                <UserCheck size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                setCurrentRow(row.original)
                setOpen('deactivate')
              }}
              className='text-amber-600!'
            >
              {t('usersUi.deactivate')}
              <DropdownMenuShortcut>
                <UserX size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
