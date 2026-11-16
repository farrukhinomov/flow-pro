import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  acceptInvitation,
  acceptInvitationWithNewAccount,
  getAccountOverview,
  previewInvitation,
  signOutOfSession,
  type InvitationPreview,
} from '@/data/api/account.api'
import {
  isAuthenticationError,
  resolveApiErrorMessage,
} from '@/data/api/api-error'
import { loadWorkspaceSession } from '@/data/auth/account-session'
import { readLinkToken, useLinkToken } from '@/data/auth/link-token'
import { useI18n } from '@/i18n'
import { CircleAlert, Loader2, UserPlus, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { resetOnboardingGuard } from '@/features/onboarding/onboarding-guard'
import { AuthLayout } from '../auth-layout'

/** Mirrors the server policy so the form can say so before submitting. */
const MIN_PASSWORD_LENGTH = 12

/**
 * The link token survives a detour through sign-in in this tab's session storage, which is
 * dropped with the tab and never sent to a server.
 */
const PENDING_INVITATION_KEY = 'flowpro.pending-invitation'

export const ACCEPT_INVITATION_PATH = '/accept-invitation'

function usePendingInvitationToken() {
  const fromLink = useLinkToken()

  return useState(() => {
    try {
      if (fromLink) {
        window.sessionStorage.setItem(PENDING_INVITATION_KEY, fromLink)
        return fromLink
      }

      const stored = window.sessionStorage.getItem(PENDING_INVITATION_KEY)
      return stored ? readLinkToken(`#token=${stored}`) : null
    } catch {
      return fromLink
    }
  })[0]
}

function forgetPendingInvitation() {
  try {
    window.sessionStorage.removeItem(PENDING_INVITATION_KEY)
  } catch {
    // Nothing stored.
  }
}

/** Starts the app in the workspace the person just joined. */
async function enterWorkspace() {
  forgetPendingInvitation()
  await loadWorkspaceSession()
  resetOnboardingGuard()
  window.location.assign('/')
}

export function AcceptInvitation() {
  const { t } = useI18n()
  const token = usePendingInvitationToken()
  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => previewInvitation(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
  // Who is signed in, if anyone. An account without a workspace yet still has one.
  const signedIn = useQuery({
    queryKey: ['invitation-account'],
    queryFn: () =>
      getAccountOverview().catch((error: unknown) => {
        if (isAuthenticationError(error)) return null
        throw error
      }),
    retry: false,
  })

  if (!token || preview.isError) {
    return (
      <InvitationCard title={t('invitationUi.invalidTitle')}>
        <Alert variant='destructive'>
          <CircleAlert className='h-4 w-4' />
          <AlertDescription>
            {preview.isError
              ? resolveApiErrorMessage(preview.error, t, 'auth.error')
              : t('invitationUi.invalidDescription')}
          </AlertDescription>
        </Alert>
      </InvitationCard>
    )
  }

  if (preview.isPending || signedIn.isPending) {
    return (
      <InvitationCard title={t('invitationUi.loadingTitle')}>
        <p className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          {t('invitationUi.loading')}
        </p>
      </InvitationCard>
    )
  }

  const invitation = preview.data
  const account = signedIn.data ?? null
  const title = t('invitationUi.title', {
    workspace: invitation.workspaceName,
  })
  const description = t('invitationUi.description', {
    email: invitation.email,
  })

  if (account && account.email === invitation.email) {
    return (
      <InvitationCard description={description} title={title}>
        <JoinWithAccount token={token} />
      </InvitationCard>
    )
  }

  if (account) {
    return (
      <InvitationCard description={description} title={title}>
        <OtherAccountSignedIn
          invitedEmail={invitation.email}
          signedInEmail={account.email}
        />
      </InvitationCard>
    )
  }

  return (
    <InvitationCard description={description} title={title}>
      {invitation.accountExists ? (
        <SignInToJoin invitation={invitation} />
      ) : (
        <CreateAccountToJoin invitation={invitation} token={token} />
      )}
    </InvitationCard>
  )
}

function JoinWithAccount({ token }: { token: string }) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  async function join() {
    setJoining(true)
    setError(null)

    try {
      await acceptInvitation(token)
      await enterWorkspace()
    } catch (reason) {
      setError(resolveApiErrorMessage(reason, t, 'auth.error'))
      setJoining(false)
    }
  }

  return (
    <div className='grid gap-3'>
      {error ? <ErrorAlert message={error} /> : null}
      <Button disabled={joining} onClick={() => void join()}>
        {joining ? <Loader2 className='animate-spin' /> : <Users />}
        {t('invitationUi.join')}
      </Button>
    </div>
  )
}

function OtherAccountSignedIn({
  invitedEmail,
  signedInEmail,
}: {
  invitedEmail: string
  signedInEmail: string
}) {
  const { t } = useI18n()

  async function signOut() {
    await signOutOfSession().catch(() => undefined)
    useAuthStore.getState().auth.reset()
    // The token stays in this tab, so the page opens again for the invited address.
    window.location.assign(ACCEPT_INVITATION_PATH)
  }

  return (
    <div className='grid gap-3'>
      <Alert>
        <CircleAlert className='h-4 w-4' />
        <AlertTitle>{t('invitationUi.otherAccountTitle')}</AlertTitle>
        <AlertDescription>
          {t('invitationUi.otherAccountDescription', {
            invited: invitedEmail,
            signedIn: signedInEmail,
          })}
        </AlertDescription>
      </Alert>
      <Button onClick={() => void signOut()} variant='outline'>
        {t('invitationUi.signOutAndContinue')}
      </Button>
    </div>
  )
}

function SignInToJoin({ invitation }: { invitation: InvitationPreview }) {
  const { t } = useI18n()

  return (
    <div className='grid gap-3'>
      <p className='text-sm text-muted-foreground'>
        {t('invitationUi.signInToJoin', { email: invitation.email })}
      </p>
      <Button asChild>
        <Link search={{ redirect: ACCEPT_INVITATION_PATH }} to='/sign-in'>
          {t('auth.signIn')}
        </Link>
      </Button>
    </div>
  )
}

function CreateAccountToJoin({
  invitation,
  token,
}: {
  invitation: InvitationPreview
  token: string
}) {
  const { t } = useI18n()
  const formSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, t('auth.errors.displayNameRequired')),
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
    defaultValues: { displayName: '', password: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await acceptInvitationWithNewAccount(
        token,
        values.displayName,
        values.password
      )
      await enterWorkspace()
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <Form {...form}>
      <form className='grid gap-3' onSubmit={form.handleSubmit(onSubmit)}>
        <p className='text-sm text-muted-foreground'>
          {t('invitationUi.createAccount', { email: invitation.email })}
        </p>
        {/* Lets password managers save the new password for the right address. */}
        <input
          autoComplete='username'
          hidden
          readOnly
          type='email'
          value={invitation.email}
        />
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
          <ErrorAlert message={form.formState.errors.root.message} />
        ) : null}
        <Button disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className='animate-spin' />
          ) : (
            <UserPlus />
          )}
          {t('invitationUi.createAndJoin')}
        </Button>
      </form>
    </Form>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant='destructive'>
      <CircleAlert className='h-4 w-4' />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function InvitationCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) {
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
      </Card>
    </AuthLayout>
  )
}
