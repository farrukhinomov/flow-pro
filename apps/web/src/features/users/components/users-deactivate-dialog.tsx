'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { UserX } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

type UserDeactivateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeactivateDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeactivateDialogProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const { deactivateUser } = useUsers()
  const viewer = useCurrentViewer()

  const handleDeactivate = async () => {
    if (value.trim() !== currentRow.username) return

    await deactivateUser(currentRow, reason, viewer.employeeId)
    onOpenChange(false)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDeactivate}
      disabled={value.trim() !== currentRow.username}
      title={
        <span className='text-amber-700 dark:text-amber-300'>
          <UserX className='me-1 inline-block' size={18} />{' '}
          {t('usersUi.deactivateUser')}
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            {t('usersUi.deactivateUserQuestion', {
              username: currentRow.username,
              role: currentRow.role.toUpperCase(),
            })}
          </p>

          <Label className='my-2'>
            {t('usersUi.username')}:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('usersUi.enterUsernameToConfirm')}
            />
          </Label>

          <Label className='my-2'>
            {t('usersUi.reason')}:
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('usersUi.optionalDeactivationReason')}
              rows={3}
            />
          </Label>

          <Alert>
            <AlertTitle>{t('usersUi.historicalRetention')}</AlertTitle>
            <AlertDescription>
              {t('usersUi.historicalRetentionDescription')}
            </AlertDescription>
          </Alert>
        </div>
      }
      confirmText={t('usersUi.deactivate')}
      destructive
    />
  )
}
