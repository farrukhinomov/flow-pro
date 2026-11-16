import { useMemo, useState } from 'react'
import type {
  InviteOutcome,
  InviteRow,
} from '@/application/onboarding-workflow'
import type { UserRole } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { Loader2, MailPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { parseInviteEmails } from '../onboarding-view-model'

const INVITE_ROLES = ['employee', 'manager', 'hr', 'admin'] satisfies UserRole[]

export function TeamStep({
  failedInvites,
  isSaving,
  onInvite,
  onSkip,
}: {
  failedInvites: InviteOutcome[]
  isSaving: boolean
  onInvite: (rows: InviteRow[]) => void
  onSkip: () => void
}) {
  const { t } = useI18n()
  const [raw, setRaw] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const parsed = useMemo(() => parseInviteEmails(raw), [raw])

  return (
    <div className='space-y-5'>
      <Alert>
        <MailPlus className='h-4 w-4' />
        <AlertTitle>{t('onboardingUi.team.deliveryTitle')}</AlertTitle>
        <AlertDescription>
          {t('onboardingUi.team.deliveryDescription')}
        </AlertDescription>
      </Alert>

      <div className='grid gap-2'>
        <Label htmlFor='onboarding-invites'>
          {t('onboardingUi.team.emailsLabel')}
        </Label>
        <Textarea
          id='onboarding-invites'
          placeholder={t('onboardingUi.team.emailsPlaceholder')}
          rows={5}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
        />
        <p className='text-xs text-muted-foreground'>
          {t('onboardingUi.team.emailsHelp')}
        </p>
      </div>

      <div className='grid gap-2 sm:max-w-xs'>
        <Label htmlFor='onboarding-invite-role'>
          {t('onboardingUi.team.roleLabel')}
        </Label>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as UserRole)}
        >
          <SelectTrigger id='onboarding-invite-role'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLES.map((inviteRole) => (
              <SelectItem key={inviteRole} value={inviteRole}>
                {t(`roles.${inviteRole}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {parsed.valid.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {parsed.valid.map((email) => (
            <Badge key={email} variant='secondary'>
              {email}
            </Badge>
          ))}
        </div>
      )}

      {parsed.invalid.length > 0 && (
        <Alert variant='destructive'>
          <AlertTitle>{t('onboardingUi.team.invalidTitle')}</AlertTitle>
          <AlertDescription>
            {t('onboardingUi.team.invalidDescription', {
              addresses: parsed.invalid.join(', '),
            })}
          </AlertDescription>
        </Alert>
      )}

      {failedInvites.length > 0 && (
        <Alert variant='destructive'>
          <AlertTitle>{t('onboardingUi.team.failedTitle')}</AlertTitle>
          <AlertDescription>
            {t('onboardingUi.team.failedDescription', {
              addresses: failedInvites.map((item) => item.email).join(', '),
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className='flex flex-wrap gap-2'>
        <Button
          disabled={isSaving || parsed.valid.length === 0}
          onClick={() =>
            onInvite(parsed.valid.map((email) => ({ email, role })))
          }
        >
          {isSaving && <Loader2 className='h-4 w-4 animate-spin' />}
          {t('onboardingUi.team.sendInvites', {
            count: String(parsed.valid.length),
          })}
        </Button>
        <Button disabled={isSaving} variant='ghost' onClick={onSkip}>
          {t('onboardingUi.skipForNow')}
        </Button>
      </div>
    </div>
  )
}
