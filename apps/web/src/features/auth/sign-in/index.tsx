import { useSearch } from '@tanstack/react-router'
import { isLocalCredentialAuthEnabled } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { DemoLogins } from './components/demo-logins'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useI18n()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const localCredentialsEnabled = isLocalCredentialAuthEnabled()

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('auth.signIn')}
          </CardTitle>
          <CardDescription>{t('auth.signInDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <DemoLogins redirectTo={redirect} />
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        {localCredentialsEnabled ? (
          <CardFooter>
            <p className='px-8 text-center text-sm text-muted-foreground'>
              {t('auth.superadminHint')}
            </p>
          </CardFooter>
        ) : null}
      </Card>
    </AuthLayout>
  )
}
