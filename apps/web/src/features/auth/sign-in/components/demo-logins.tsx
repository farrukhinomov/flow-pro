import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDemoInfo, signInWithPassword } from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { isDemoMode } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import { Loader2, Shield, UserRound, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useFinishSignIn } from '../use-finish-sign-in'

const ROLE_ICONS: Record<string, typeof Shield> = {
  superadmin: Shield,
  manager: Users,
  employee: UserRound,
}

/**
 * One-click sign-in to the shared demo logins. Shown only when the instance runs the public demo;
 * the API answers 404 otherwise.
 */
export function DemoLogins({ redirectTo }: { redirectTo?: string }) {
  const { t } = useI18n()
  const finishSignIn = useFinishSignIn(redirectTo)
  const [signingIn, setSigningIn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const demo = useQuery({
    queryKey: ['demo-info'],
    queryFn: getDemoInfo,
    enabled: isDemoMode(),
    retry: false,
    staleTime: Infinity,
  })

  if (!demo.data) return null

  async function signInAs(email: string, displayName: string) {
    setSigningIn(email)
    setError(null)

    try {
      const result = await signInWithPassword(email, demo.data!.password)
      // Shared logins cannot turn on two-step sign-in, so a session always follows.
      if (result.status === 'signed-in') await finishSignIn(displayName)
    } catch (reason) {
      setError(resolveApiErrorMessage(reason, t, 'auth.error'))
    } finally {
      setSigningIn(null)
    }
  }

  return (
    <div className='grid gap-3'>
      <div className='grid gap-1'>
        <p className='text-sm font-medium'>{t('demoUi.title')}</p>
        <p className='text-xs text-muted-foreground'>
          {t('demoUi.description', { time: demo.data.resetAtUtc })}
        </p>
      </div>
      <div className='grid gap-2'>
        {demo.data.logins.map((login) => {
          const Icon = ROLE_ICONS[login.roleKey] ?? UserRound

          return (
            <Button
              className='h-auto justify-start py-2 text-left'
              disabled={signingIn !== null}
              key={login.email}
              onClick={() => void signInAs(login.email, login.displayName)}
              variant='outline'
            >
              {signingIn === login.email ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Icon />
              )}
              <span className='grid'>
                <span>
                  {t('demoUi.signInAs', {
                    role: t(`demoUi.roles.${login.roleKey}`),
                  })}
                </span>
                <span className='text-xs font-normal text-muted-foreground'>
                  {login.displayName}
                </span>
              </span>
            </Button>
          )
        })}
      </div>
      {error ? (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <p className='text-xs text-muted-foreground'>
        {t('demoUi.manualHint', { password: demo.data.password })}
      </p>
      <div className='flex items-center gap-3'>
        <Separator className='flex-1' />
        <span className='text-xs text-muted-foreground'>{t('demoUi.or')}</span>
        <Separator className='flex-1' />
      </div>
    </div>
  )
}
