import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changePassword,
  getAccountOverview,
  requestEmailChange,
  resendEmailVerification,
  revokeOtherSessions,
  revokeSession,
  type AccountSessionSummary,
} from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/i18n/format'
import {
  CircleAlert,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailPlus,
  Monitor,
} from 'lucide-react'
import { toast } from 'sonner'
import { describeUserAgent } from '@/lib/user-agent'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PasswordInput } from '@/components/password-input'
import { ContentSection } from '../components/content-section'
import { TwoFactorSection } from './two-factor-section'

/** Mirrors the server policy so the form can say so before submitting. */
const MIN_PASSWORD_LENGTH = 12
const ACCOUNT_QUERY_KEY = ['account-overview'] as const

export function SettingsSecurity() {
  const { t } = useI18n()
  const account = useQuery({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: getAccountOverview,
  })

  return (
    <ContentSection
      desc={t('settingsUi.securityDescription')}
      title={t('settingsUi.security')}
    >
      <div className='grid gap-8'>
        {account.isPending ? (
          <Skeleton className='h-24 w-full' />
        ) : account.isError ? (
          <Alert variant='destructive'>
            <CircleAlert className='h-4 w-4' />
            <AlertDescription>
              {resolveApiErrorMessage(account.error, t, 'auth.error')}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {account.data.isSharedDemoLogin ? (
              <Alert>
                <Lock className='h-4 w-4' />
                <AlertDescription>{t('demoUi.sharedLogin')}</AlertDescription>
              </Alert>
            ) : null}
            <EmailSection
              confirmed={account.data.emailConfirmed}
              email={account.data.email}
            />
            {account.data.isSharedDemoLogin ? null : (
              <>
                <ChangeEmailSection email={account.data.email} />
                <Separator />
                <ChangePasswordSection email={account.data.email} />
                <Separator />
                <TwoFactorSection
                  accountQueryKey={ACCOUNT_QUERY_KEY}
                  email={account.data.email}
                  enabled={account.data.twoFactorEnabled}
                  recoveryCodesLeft={account.data.recoveryCodesLeft}
                />
              </>
            )}
            <Separator />
            <SessionsSection
              canEndSessions={!account.data.isSharedDemoLogin}
              sessions={account.data.sessions}
            />
          </>
        )}
      </div>
    </ContentSection>
  )
}

function EmailSection({
  confirmed,
  email,
}: {
  confirmed: boolean
  email: string
}) {
  const { t } = useI18n()
  const resend = useMutation({
    mutationFn: resendEmailVerification,
    onSuccess: () => toast.success(t('settingsUi.confirmationSent', { email })),
    onError: (error) =>
      toast.error(resolveApiErrorMessage(error, t, 'auth.error')),
  })

  return (
    <section className='grid gap-3'>
      <h4 className='font-medium'>{t('settingsUi.emailAddress')}</h4>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-sm'>{email}</span>
        <Badge variant={confirmed ? 'secondary' : 'outline'}>
          {confirmed
            ? t('settingsUi.emailConfirmed')
            : t('settingsUi.emailNotConfirmed')}
        </Badge>
      </div>
      {confirmed ? null : (
        <div>
          <Button
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
            size='sm'
            variant='outline'
          >
            {resend.isPending ? <Loader2 className='animate-spin' /> : <Mail />}
            {t('settingsUi.resendConfirmation')}
          </Button>
        </div>
      )}
    </section>
  )
}

function ChangeEmailSection({ email }: { email: string }) {
  const { t } = useI18n()
  const formSchema = useMemo(
    () =>
      z.object({
        newEmail: z.email({
          error: (iss) =>
            iss.input === ''
              ? t('auth.errors.emailRequired')
              : t('apiErrors.account.email_invalid'),
        }),
        currentPassword: z.string().min(1, t('auth.errors.passwordRequired')),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await requestEmailChange(values.currentPassword, values.newEmail)
      form.reset()
      toast.success(
        t('settingsUi.emailChangeSent', { email: values.newEmail.trim() })
      )
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <section className='grid gap-3'>
      <div>
        <h4 className='font-medium'>{t('settingsUi.changeEmail')}</h4>
        <p className='text-sm text-muted-foreground'>
          {t('settingsUi.changeEmailDescription')}
        </p>
      </div>
      <Form {...form}>
        <form
          className='grid max-w-md gap-3'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Lets password managers fill the password of the right account. */}
          <input
            autoComplete='username'
            hidden
            readOnly
            type='text'
            value={email}
          />
          <FormField
            control={form.control}
            name='newEmail'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settingsUi.newEmail')}</FormLabel>
                <FormControl>
                  <Input autoComplete='email' type='email' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='currentPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settingsUi.currentPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete='current-password' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root?.message ? (
            <Alert variant='destructive'>
              <CircleAlert className='h-4 w-4' />
              <AlertDescription>
                {form.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <MailPlus />
              )}
              {t('settingsUi.changeEmail')}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  )
}

function ChangePasswordSection({ email }: { email: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const formSchema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('auth.errors.passwordRequired')),
        newPassword: z
          .string()
          .min(
            MIN_PASSWORD_LENGTH,
            t('auth.errors.passwordTooShort', { count: MIN_PASSWORD_LENGTH })
          ),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await changePassword(
        values.currentPassword,
        values.newPassword
      )
      form.reset()
      toast.success(
        t('settingsUi.passwordChanged', { count: result.otherSessionsEnded })
      )
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <section className='grid gap-3'>
      <div>
        <h4 className='font-medium'>{t('settingsUi.changePassword')}</h4>
        <p className='text-sm text-muted-foreground'>
          {t('settingsUi.changePasswordDescription')}
        </p>
      </div>
      <Form {...form}>
        <form
          className='grid max-w-md gap-3'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Lets password managers update the entry for the right account. */}
          <input
            autoComplete='username'
            hidden
            readOnly
            type='text'
            value={email}
          />
          <FormField
            control={form.control}
            name='currentPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settingsUi.currentPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete='current-password' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='newPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.newPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete='new-password' {...field} />
                </FormControl>
                <FormDescription>
                  {t('auth.passwordPolicy', { count: MIN_PASSWORD_LENGTH })}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root?.message ? (
            <Alert variant='destructive'>
              <CircleAlert className='h-4 w-4' />
              <AlertDescription>
                {form.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <KeyRound />
              )}
              {t('settingsUi.changePassword')}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  )
}

function SessionsSection({
  canEndSessions,
  sessions,
}: {
  /** False for a shared demo login, whose other sessions are other visitors. */
  canEndSessions: boolean
  sessions: AccountSessionSummary[]
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      toast.success(t('settingsUi.sessionEnded'))
      await refresh()
    },
    onError: (error) =>
      toast.error(resolveApiErrorMessage(error, t, 'auth.error')),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async (result) => {
      toast.success(t('settingsUi.otherSessionsEnded', { count: result.count }))
      await refresh()
    },
    onError: (error) =>
      toast.error(resolveApiErrorMessage(error, t, 'auth.error')),
  })
  const hasOthers =
    canEndSessions && sessions.some((session) => !session.isCurrent)

  return (
    <section className='grid gap-3'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <h4 className='font-medium'>{t('settingsUi.sessions')}</h4>
          <p className='text-sm text-muted-foreground'>
            {t('settingsUi.sessionsDescription')}
          </p>
        </div>
        {hasOthers ? (
          <Button
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
            size='sm'
            variant='outline'
          >
            {revokeOthers.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <LogOut />
            )}
            {t('settingsUi.signOutOtherSessions')}
          </Button>
        ) : null}
      </div>
      <ul className='grid gap-2'>
        {sessions.map((session) => (
          <SessionRow
            canEnd={canEndSessions}
            busy={
              revokeOne.isPending && revokeOne.variables === session.sessionId
            }
            key={session.sessionId}
            onRevoke={() => revokeOne.mutate(session.sessionId)}
            session={session}
          />
        ))}
      </ul>
    </section>
  )
}

function SessionRow({
  busy,
  canEnd,
  onRevoke,
  session,
}: {
  busy: boolean
  canEnd: boolean
  onRevoke: () => void
  session: AccountSessionSummary
}) {
  const { locale, t } = useI18n()
  const device = describeUserAgent(session.userAgent)
  const name =
    device.browser && device.os
      ? t('settingsUi.deviceName', { browser: device.browser, os: device.os })
      : (device.browser ?? device.os ?? t('settingsUi.unknownDevice'))

  return (
    <li className='flex flex-wrap items-center justify-between gap-3 rounded-md border p-3'>
      <div className='flex min-w-0 items-start gap-3'>
        <Monitor className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
        <div className='grid min-w-0 gap-0.5'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-sm font-medium'>{name}</span>
            {session.isCurrent ? (
              <Badge variant='secondary'>{t('settingsUi.thisDevice')}</Badge>
            ) : null}
          </div>
          <span className='text-xs text-muted-foreground'>
            {t('settingsUi.sessionDetails', {
              ip: session.ipAddress ?? '-',
              lastSeen: formatDateTime(session.lastSeenAt, locale),
              signedIn: formatDateTime(session.createdAt, locale),
            })}
          </span>
        </div>
      </div>
      {session.isCurrent || !canEnd ? null : (
        <Button disabled={busy} onClick={onRevoke} size='sm' variant='ghost'>
          {busy ? <Loader2 className='animate-spin' /> : <LogOut />}
          {t('settingsUi.endSession')}
        </Button>
      )}
    </li>
  )
}
