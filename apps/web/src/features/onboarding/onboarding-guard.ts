import { onboardingWorkflow } from '@/application/onboarding-workflow'
import type { ApiOnboardingStateDto } from '@/contracts/api'
import { isOnboardingComplete } from './onboarding-view-model'

/**
 * Setup state changes at most twice in a workspace's life, so it is fetched once per session
 * rather than on every navigation inside the authenticated shell.
 */
let cachedState: Promise<ApiOnboardingStateDto | null> | null = null

export function resetOnboardingGuard() {
  cachedState = null
}

/**
 * Whether the authenticated user should be sent to the setup wizard.
 *
 * Fails open: FlowPro is offline-capable, and a workspace that is already set up must stay usable
 * when the API is unreachable. An unknown state therefore never blocks navigation.
 */
export async function requiresOnboarding(): Promise<boolean> {
  cachedState ??= onboardingWorkflow.getOnboardingState().catch(() => null)

  const state = await cachedState

  return state !== null && !isOnboardingComplete(state)
}
