import {
  parseApiCompanyProfileDto,
  parseApiOnboardingStateDto,
  parseApiWorkspaceClaimResultDto,
  parseApiWorkspaceClaimStateDto,
  type ApiCompanyProfileDto,
  type ApiOnboardingStateDto,
  type ApiOnboardingStepKey,
  type ApiWorkspaceClaimResultDto,
  type ApiWorkspaceClaimStateDto,
} from '@/contracts/api'
import { FlowProApiError, flowProApi } from './http-client'

export type ClaimWorkspaceInput = {
  workspaceName: string
  slug?: string
}

export type SaveCompanyProfileInput = {
  companyName: string
  countryCode?: string
  regionCode?: string
  timeZoneId: string
  weeklyHours: number
}

export async function getWorkspaceClaimState(): Promise<ApiWorkspaceClaimStateDto> {
  const response = await flowProApi.get<unknown>('/onboarding/workspace')

  return parseApiWorkspaceClaimStateDto(response.data)
}

export async function claimWorkspace(
  input: ClaimWorkspaceInput
): Promise<ApiWorkspaceClaimResultDto> {
  const response = await flowProApi.post<unknown>('/onboarding/workspace', {
    slug: input.slug,
    workspaceName: input.workspaceName,
  })

  return parseApiWorkspaceClaimResultDto(response.data)
}

export async function getOnboardingState(): Promise<ApiOnboardingStateDto> {
  const response = await flowProApi.get<unknown>('/onboarding/state')

  return parseApiOnboardingStateDto(response.data)
}

export async function saveCompanyProfile(
  input: SaveCompanyProfileInput
): Promise<ApiCompanyProfileDto> {
  const response = await flowProApi.put<unknown>('/onboarding/steps/company', {
    companyName: input.companyName,
    countryCode: input.countryCode,
    regionCode: input.regionCode,
    timeZoneId: input.timeZoneId,
    weeklyHours: input.weeklyHours,
  })

  return parseApiCompanyProfileDto(response.data)
}

export async function resolveOnboardingStep(
  step: ApiOnboardingStepKey,
  options: { skipped?: boolean } = {}
): Promise<ApiOnboardingStateDto> {
  const response = await flowProApi.post<unknown>(
    `/onboarding/steps/${step}/resolve`,
    { skipped: options.skipped ?? false }
  )

  return parseApiOnboardingStateDto(response.data)
}

export async function completeOnboarding(): Promise<ApiOnboardingStateDto> {
  const response = await flowProApi.post<unknown>('/onboarding/complete')

  return parseApiOnboardingStateDto(response.data)
}

/**
 * A signed-in identity provider account with no FlowPro tenant is the self-serve signup case, not
 * an error. The API cannot resolve a tenant for that token, so `/auth/session` answers 401.
 */
export function isUnclaimedWorkspaceError(error: unknown): boolean {
  return error instanceof FlowProApiError && error.status === 401
}

export function isWorkspaceAlreadyClaimedError(error: unknown): boolean {
  return (
    error instanceof FlowProApiError &&
    error.code === 'onboarding.workspace_already_claimed'
  )
}
