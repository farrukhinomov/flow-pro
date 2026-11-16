import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  confirmEmailChange,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { useLinkToken } from '@/data/auth/link-token'
import { useI18n } from '@/i18n'
import { CircleAlert, CircleCheck, KeyRound, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { PasswordInput } from '@/components/password-input'
import { AuthLayout } from '../auth-layout'

/** Mirrors the server policy so the form can say so before submitting. */
const MIN_PASSWORD_LENGTH = 12

export function ForgotPassword() {
  const { t } = useI18n()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const formSchema = useMemo(
    () =>
      z.object({
        email: z.email({
          error: (iss) =>
            iss.input === '' ? t('auth.errors.emailRequired') : undefined,
        }),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: z.infer<typeof formSchema>) {
    const normalized = email.trim().toLowerCase()

    try {
      await requestPasswordReset(normalized)
      setSentTo(normalized)
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <RecoveryCard
      description={t('auth.forgotPasswordDescription')}
      title={t('auth.forgotPasswordTitle')}
    >
      {sentTo ? (
        <Alert>
          <Mail className='h-4 w-4' />
          <AlertDescription>
            {t('auth.resetLinkSent', { email: sentTo })}
          </AlertDescription>
        </Alert>
      ) : (
        <Form {...form}>
          <form className='grid gap-3' onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='email'
                      placeholder={t('auth.emailPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <RootError message={form.formState.errors.root?.message} />
            <Button className='mt-2' disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Mail />
              )}
              {t('auth.sendResetLink')}
            </Button>
          </form>
        </Form>
      )}
    </RecoveryCard>
  )
}

export function ResetPassword() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const token = useLinkToken()
  const formSchema = useMemo(
    () =>
      z.object({
        password: z
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
    defaultValues: { password: '' },
  })

  async function onSubmit({ password }: z.infer<typeof formSchema>) {
    if (!token) return

    try {
      await resetPassword(token, password)
      // The reset ended every session of the account, possibly including one this browser
      // still shows as signed in.
      useAuthStore.getState().auth.reset()
      toast.success(t('auth.passwordResetDone'))
      await navigate({ to: '/sign-in', replace: true })
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <RecoveryCard
      description={t('auth.resetPasswordDescription')}
      title={t('auth.resetPasswordTitle')}
    >
      {token ? (
        <Form {...form}>
          <form className='grid gap-3' onSubmit={form.handleSubmit(onSubmit)}>
            {/* Lets password managers save the new password for the right account. */}
            <input autoComplete='username' hidden readOnly type='text' />
            <FormField
              control={form.control}
              name='password'
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
            <RootError
              action={<RequestNewLink />}
              message={form.formState.errors.root?.message}
            />
            <Button className='mt-2' disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <KeyRound />
              )}
              {t('auth.setNewPassword')}
            </Button>
          </form>
        </Form>
      ) : (
        <InvalidLink />
      )}
    </RecoveryCard>
  )
}

type LinkState = 'working' | 'done' | 'failed'

export function VerifyEmail() {
  const { t } = useI18n()

  return (
    <EmailLinkPage
      redeem={async (token) => {
        await verifyEmail(token)
        return t('auth.emailVerified')
      }}
      title={t('auth.verifyEmailTitle')}
      workingText={t('auth.verifyingEmail')}
    />
  )
}

export function ConfirmEmailChange() {
  const { t } = useI18n()

  return (
    <EmailLinkPage
      redeem={async (token) => {
        const email = await confirmEmailChange(token)
        // A browser that is signed in to this account shows the new address right away.
        const { auth } = useAuthStore.getState()
        if (auth.user) auth.setUser({ ...auth.user, email })
        return t('auth.emailChanged', { email })
      }}
      title={t('auth.confirmEmailChangeTitle')}
      workingText={t('auth.confirmingEmailChange')}
    />
  )
}

/** Redeems the single-use token from an email link as soon as the page opens. */
function EmailLinkPage({
  redeem,
  title,
  workingText,
}: {
  redeem: (token: string) => Promise<string>
  title: string
  workingText: string
}) {
  const { t } = useI18n()
  const token = useLinkToken()
  const [state, setState] = useState<LinkState>(token ? 'working' : 'failed')
  const [message, setMessage] = useState<string | null>(null)
  // The token works once, so the request must not repeat when React re-runs the effect.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true

    redeem(token)
      .then((done) => {
        setMessage(done)
        setState('done')
      })
      .catch((reason: unknown) => {
        setMessage(resolveApiErrorMessage(reason, t, 'auth.error'))
        setState('failed')
      })
  }, [redeem, t, token])

  return (
    <RecoveryCard title={title}>
      {state === 'working' ? (
        <p className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          {workingText}
        </p>
      ) : null}
      {state === 'done' ? (
        <div className='grid gap-4'>
          <Alert>
            <CircleCheck className='h-4 w-4' />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button asChild>
            <Link to='/'>{t('auth.continueToApp')}</Link>
          </Button>
        </div>
      ) : null}
      {state === 'failed' ? (
        <Alert variant='destructive'>
          <CircleAlert className='h-4 w-4' />
          <AlertTitle>{t('auth.linkInvalidTitle')}</AlertTitle>
          <AlertDescription>
            {message ?? t('auth.linkMissing')}
          </AlertDescription>
        </Alert>
      ) : null}
    </RecoveryCard>
  )
}

function RecoveryCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) {
  const { t } = useI18n()

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter>
          <p className='w-full text-center text-sm text-muted-foreground'>
            <Link className='underline underline-offset-4' to='/sign-in'>
              {t('auth.returnToSignIn')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}

function InvalidLink() {
  const { t } = useI18n()

  return (
    <Alert variant='destructive'>
      <CircleAlert className='h-4 w-4' />
      <AlertTitle>{t('auth.linkInvalidTitle')}</AlertTitle>
      <AlertDescription>
        <p>{t('auth.linkMissing')}</p>
        <RequestNewLink />
      </AlertDescription>
    </Alert>
  )
}

function RequestNewLink() {
  const { t } = useI18n()

  return (
    <Link className='underline underline-offset-4' to='/forgot-password'>
      {t('auth.requestNewLink')}
    </Link>
  )
}

function RootError({
  action,
  message,
}: {
  action?: React.ReactNode
  message?: string
}) {
  if (!message) return null

  return (
    <Alert variant='destructive'>
      <CircleAlert className='h-4 w-4' />
      <AlertDescription>
        <p>{message}</p>
        {action}
      </AlertDescription>
    </Alert>
  )
}
