import { useCallback, useEffect, useState } from 'react'
import { onboardingWorkflow } from '@/application/onboarding-workflow'
import type { ApiOnboardingStateDto } from '@/contracts/api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { getCurrentAuthSession } from '@/data/api/auth.api'
import { useI18n } from '@/i18n'

type OnboardingStatus = {
  error: string | null
  isLoading: boolean
  isSaving: boolean
  refresh: () => Promise<void>
  runStep: <T>(action: () => Promise<T>) => Promise<T | null>
  setState: (state: ApiOnboardingStateDto) => void
  state: ApiOnboardingStateDto | null
  workspaceName: string
}

export function useOnboarding(): OnboardingStatus {
  const { t } = useI18n()
  const [state, setState] = useState<ApiOnboardingStateDto | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      // The workspace name chosen at claim time is the natural default for the company step.
      const [nextState, session] = await Promise.all([
        onboardingWorkflow.getOnboardingState(),
        getCurrentAuthSession().catch(() => null),
      ])

      setState(nextState)
      setWorkspaceName(session?.tenantName ?? '')
      setError(null)
    } catch (caught) {
      setError(resolveApiErrorMessage(caught, t, 'onboardingUi.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    // refresh() only sets state after its first await, so this cannot cascade renders; the
    // rule cannot see through the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  /**
   * Runs one wizard action and keeps the wizard usable when it fails: the error is surfaced, the
   * step stays where it is, and the user can retry or skip rather than losing the whole setup.
   */
  const runStep = useCallback(
    async <T>(action: () => Promise<T>) => {
      setIsSaving(true)
      setError(null)

      try {
        return await action()
      } catch (caught) {
        setError(resolveApiErrorMessage(caught, t, 'onboardingUi.stepFailed'))
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [t]
  )

  return {
    error,
    isLoading,
    isSaving,
    refresh,
    runStep,
    setState,
    state,
    workspaceName,
  }
}
