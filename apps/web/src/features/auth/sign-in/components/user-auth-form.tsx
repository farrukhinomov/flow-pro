import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { signInWithPassword } from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import {
  isLocalCredentialAuthEnabled,
  isRegistrationEnabled,
} from '@/data/auth/auth-mode'
import { listEmployeeUsers } from '@/data/local/users.repo'
import { findLocalUserCredential } from '@/domain/users/local-credentials'
import { useI18n } from '@/i18n'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import {
  createLocalAuthUser,
  getSafeRedirectPath,
  useAuthStore,
} from '@/stores/auth-store'
import { sleep, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { useFinishSignIn } from '../use-finish-sign-in'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

type Credentials = { email: string; password: string }

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const { t } = useI18n()
  const finishSignIn = useFinishSignIn(redirectTo)
  const localCredentials = isLocalCredentialAuthEnabled()
  const registrationEnabled = isRegistrationEnabled()
  const formSchema = useMemo(
    () =>
      z.object({
        email: z.email({
          error: (iss) =>
            iss.input === '' ? t('auth.errors.emailRequired') : undefined,
        }),
        // No length rule here: telling someone at sign-in how long passwords must be only helps
        // guessing. The policy is enforced when the password is chosen.
        password: z.string().min(1, t('auth.errors.passwordRequired')),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function signInWithSession({ email, password }: Credentials) {
    try {
      const result = await signInWithPassword(email, password)

      if (result.status === 'code-required') {
        await navigate({ to: '/two-factor', search: { redirect: redirectTo } })
        return
      }

      await finishSignIn(email)
    } catch (error) {
      form.setError('password', {
        message: resolveApiErrorMessage(error, t, 'auth.invalidCredentials', {
          unauthorized: 'auth.invalidCredentials',
        }),
      })
    }
  }

  async function signInWithSimulation({ email, password }: Credentials) {
    // Loaded on demand rather than imported: this form is part of every build,
    // and a static import would pull the whole demo directory into production.
    const { seedUserCredentials, seedUsers } = await import('@/demo')
    const signIn = sleep(700).then(async () => {
      const credential =
        seedUserCredentials.find(
          (seedCredential) =>
            seedCredential.email.toLowerCase() === email &&
            seedCredential.password === password
        ) ?? (await findLocalUserCredential(email, password))

      if (!credential) {
        throw new Error('Invalid local credentials')
      }

      const localUsers = await listEmployeeUsers()
      const employee =
        localUsers.find((user) => user.id === credential.userId) ??
        seedUsers.find((user) => user.id === credential.userId)

      if (!employee || employee.status !== 'active') {
        throw new Error('Account is not active')
      }

      auth.setUser(
        createLocalAuthUser({
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          role: employee.role,
          team: employee.team,
          userId: employee.id,
        })
      )
      auth.setAccessToken(`local-session-${employee.id}`)
      navigate({ to: getSafeRedirectPath(redirectTo), replace: true })

      return employee
    })

    toast.promise(signIn, {
      loading: t('auth.signingIn'),
      success: (employee) =>
        t('auth.welcomeBack', {
          name: `${employee.firstName} ${employee.lastName}`,
        }),
      error: t('auth.invalidCredentials'),
    })

    await signIn.catch(() => {
      form.setError('password', { message: t('auth.invalidCredentials') })
    })
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const credentials = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
    }

    try {
      await (localCredentials
        ? signInWithSimulation(credentials)
        : signInWithSession(credentials))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.email')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete='username'
                  placeholder={t('auth.emailPlaceholder')}
                  type='email'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>{t('auth.password')}</FormLabel>
                {localCredentials ? null : (
                  <Link
                    className='text-sm text-muted-foreground underline-offset-4 hover:underline'
                    to='/forgot-password'
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                )}
              </div>
              <FormControl>
                <PasswordInput
                  autoComplete='current-password'
                  placeholder={t('auth.passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          {t('auth.signIn')}
        </Button>

        {localCredentials ? (
          <p className='text-center text-xs text-muted-foreground'>
            {t('auth.simulationHint')}
          </p>
        ) : null}

        {registrationEnabled ? (
          <p className='text-center text-sm text-muted-foreground'>
            {t('auth.noWorkspaceYet')}{' '}
            <Link className='underline underline-offset-4' to='/sign-up'>
              {t('auth.createWorkspace')}
            </Link>
          </p>
        ) : null}
      </form>
    </Form>
  )
}
