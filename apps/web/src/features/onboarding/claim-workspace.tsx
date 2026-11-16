import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { onboardingWorkflow } from '@/application/onboarding-workflow'
import {
  isAuthenticationError,
  resolveApiErrorMessage,
} from '@/data/api/api-error'
import { isWorkspaceAlreadyClaimedError } from '@/data/api/onboarding.api'
import { loadWorkspaceSession } from '@/data/auth/account-session'
import { useI18n } from '@/i18n'
import { AlertTriangle, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthLayout } from '@/features/auth/auth-layout'

/**
 * The step between "has a FlowPro account" and "has a FlowPro workspace".
 *
 * Reached right after registration, or after signing in with an account that belongs to no
 * workspace yet. Claiming provisions the tenant, after which the session resolves to a membership
 * and the setup wizard opens.
 */
export function ClaimWorkspace() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadClaimState() {
      try {
        const state = await onboardingWorkflow.getWorkspaceClaimState()

        if (cancelled) return

        if (state.hasWorkspace) {
          await navigate({ replace: true, to: '/' })
          return
        }

        setEmail(state.email)
        setWorkspaceName(state.suggestedWorkspaceName)
      } catch (caught) {
        if (cancelled) return

        if (isAuthenticationError(caught)) {
          setSignedIn(false)
          return
        }

        setError(resolveApiErrorMessage(caught, t, 'onboardingUi.loadFailed'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadClaimState()

    return () => {
      cancelled = true
    }
  }, [navigate, t])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()

      const name = workspaceName.trim()

      if (name.length < 2) {
        setError(t('onboardingUi.errors.workspaceNameRequired'))
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        await onboardingWorkflow.claimWorkspace(name)

        // The session now resolves to the new membership.
        await loadWorkspaceSession()

        toast.success(t('onboardingUi.workspaceCreatedToast'))
        await navigate({ replace: true, to: '/onboarding' })
      } catch (caught) {
        setError(
          isWorkspaceAlreadyClaimedError(caught)
            ? t('onboardingUi.errors.alreadyClaimed')
            : resolveApiErrorMessage(caught, t, 'onboardingUi.stepFailed')
        )
      } finally {
        setIsSaving(false)
      }
    },
    [navigate, t, workspaceName]
  )

  if (!signedIn) {
    return (
      <AuthLayout>
        <Card>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              {t('onboardingUi.claim.signInRequiredTitle')}
            </CardTitle>
            <CardDescription>
              {t('onboardingUi.claim.signInRequiredDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void navigate({ to: '/sign-in' })}>
              {t('auth.returnToSignIn')}
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('onboardingUi.claim.title')}
          </CardTitle>
          <CardDescription>
            {t('onboardingUi.claim.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-40' />
            </div>
          ) : (
            <form className='space-y-4' noValidate onSubmit={handleSubmit}>
              {email && (
                <p className='text-sm text-muted-foreground'>
                  {t('onboardingUi.claim.signedInAs', { email })}
                </p>
              )}

              <div className='grid gap-2'>
                <Label htmlFor='workspace-name'>
                  {t('onboardingUi.claim.nameLabel')}
                </Label>
                <Input
                  autoFocus
                  aria-invalid={!!error}
                  id='workspace-name'
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  {t('onboardingUi.claim.nameHelp')}
                </p>
              </div>

              {error && (
                <Alert variant='destructive'>
                  <AlertTriangle className='h-4 w-4' />
                  <AlertTitle>{t('onboardingUi.claim.errorTitle')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button className='w-full' disabled={isSaving} type='submit'>
                {isSaving ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Building2 className='h-4 w-4' />
                )}
                {t('onboardingUi.claim.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
