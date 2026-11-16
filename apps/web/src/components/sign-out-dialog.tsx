import { useNavigate, useLocation } from '@tanstack/react-router'
import { signOutOfSession } from '@/data/api/account.api'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { resetOnboardingGuard } from '@/features/onboarding/onboarding-guard'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { auth } = useAuthStore()

  const handleSignOut = async () => {
    if (isSessionAuthEnabled()) {
      // Ends the session on the server too, so the cookie is useless even if it was copied.
      // Signing out locally still happens if the request fails.
      await signOutOfSession().catch(() => undefined)
    }

    auth.reset()
    // Setup state is cached per session and belongs to the workspace that just signed out.
    resetOnboardingGuard()

    // Preserve current location for redirect after sign-in
    navigate({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profileUi.signOut')}
      desc={t('profileUi.signOutDescription')}
      confirmText={t('profileUi.signOut')}
      destructive
      handleConfirm={() => void handleSignOut()}
      className='sm:max-w-sm'
    />
  )
}
