import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { registerAccount } from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { isRegistrationEnabled } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import {
  CalendarCheck,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
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

export function SignUp() {
  const { t } = useI18n()
  const registrationEnabled = isRegistrationEnabled()

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('auth.signUpTitle')}
          </CardTitle>
          <CardDescription>{t('auth.signUpDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <ul className='grid gap-3'>
            <ValueProp
              icon={ShieldCheck}
              text={t('auth.signUpValueCompliance')}
            />
            <ValueProp icon={CalendarCheck} text={t('auth.signUpValueLeave')} />
            <ValueProp icon={Users} text={t('auth.signUpValueTeam')} />
          </ul>

          {registrationEnabled ? (
            <SignUpForm />
          ) : (
            <Alert>
              <ShieldCheck className='h-4 w-4' />
              <AlertTitle>{t('auth.signUpUnavailableTitle')}</AlertTitle>
              <AlertDescription>
                {t('auth.signUpUnavailableDescription')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <p className='w-full text-center text-sm text-muted-foreground'>
            {t('auth.signUpHaveAccount')}{' '}
            <Link className='underline underline-offset-4' to='/sign-in'>
              {t('auth.signIn')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}

function SignUpForm() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, t('auth.errors.displayNameRequired'))
          .max(200),
        email: z.email({
          error: (iss) =>
            iss.input === '' ? t('auth.errors.emailRequired') : undefined,
        }),
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
    defaultValues: { displayName: '', email: '', password: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsSubmitting(true)

    try {
      await registerAccount({
        displayName: data.displayName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      })
      // The new account has no workspace yet; claiming one is the next step.
      await navigate({ to: '/claim-workspace', replace: true })
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.signUpFailed'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form className='grid gap-3' onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name='displayName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.displayName')}</FormLabel>
              <FormControl>
                <Input autoComplete='name' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormLabel>{t('auth.password')}</FormLabel>
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
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <Button className='mt-2 w-full' disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <UserPlus className='h-4 w-4' />
          )}
          {t('auth.signUpAction')}
        </Button>
      </form>
    </Form>
  )
}

function ValueProp({
  icon: Icon,
  text,
}: {
  icon: typeof ShieldCheck
  text: string
}) {
  return (
    <li className='flex items-start gap-3 text-sm'>
      <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
        <Icon className='h-4 w-4' />
      </span>
      <span className='text-muted-foreground'>{text}</span>
    </li>
  )
}
