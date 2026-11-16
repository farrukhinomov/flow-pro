import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearch } from '@tanstack/react-router'
import { completeTwoFactorSignIn } from '@/data/api/account.api'
import { isFlowProApiError, resolveApiErrorMessage } from '@/data/api/api-error'
import { useI18n } from '@/i18n'
import { CircleAlert, Loader2, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '../auth-layout'
import { useFinishSignIn } from '../sign-in/use-finish-sign-in'

const CHALLENGE_EXPIRED = 'account.two_factor_challenge_expired'

/**
 * The second sign-in step: a code from the authenticator app, or a recovery code. The server
 * remembers that the password was right through an HttpOnly cookie that lasts a few minutes.
 */
export function TwoFactorSignIn() {
  const { t } = useI18n()
  const { redirect } = useSearch({ from: '/(auth)/two-factor' })
  const finishSignIn = useFinishSignIn(redirect)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [expired, setExpired] = useState(false)
  const formSchema = useMemo(
    () =>
      z.object({
        code: z.string().trim().min(1, t('twoFactorUi.codeRequired')),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const account = await completeTwoFactorSignIn(values.code)
      await finishSignIn(account.displayName)
    } catch (error) {
      if (isFlowProApiError(error) && error.code === CHALLENGE_EXPIRED) {
        setExpired(true)
        return
      }

      form.setError('code', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  function switchMode() {
    setUseRecoveryCode((current) => !current)
    form.reset({ code: '' })
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('twoFactorUi.signInTitle')}
          </CardTitle>
          <CardDescription>
            {useRecoveryCode
              ? t('twoFactorUi.signInRecoveryDescription')
              : t('twoFactorUi.signInDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expired ? (
            <div className='grid gap-3'>
              <Alert variant='destructive'>
                <CircleAlert className='h-4 w-4' />
                <AlertDescription>
                  {t(`apiErrors.${CHALLENGE_EXPIRED}`)}
                </AlertDescription>
              </Alert>
              <Button asChild>
                <Link search={{ redirect }} to='/sign-in'>
                  {t('auth.signIn')}
                </Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                className='grid gap-3'
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name='code'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {useRecoveryCode
                          ? t('twoFactorUi.recoveryCode')
                          : t('twoFactorUi.code')}
                      </FormLabel>
                      <FormControl>
                        {useRecoveryCode ? (
                          <Input
                            autoCapitalize='none'
                            autoComplete='off'
                            autoFocus
                            spellCheck={false}
                            {...field}
                          />
                        ) : (
                          <Input
                            autoComplete='one-time-code'
                            autoFocus
                            inputMode='numeric'
                            maxLength={7}
                            {...field}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button className='mt-2' disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <ShieldCheck />
                  )}
                  {t('twoFactorUi.verify')}
                </Button>
                <Button onClick={switchMode} type='button' variant='link'>
                  {useRecoveryCode
                    ? t('twoFactorUi.useApp')
                    : t('twoFactorUi.useRecoveryCode')}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
