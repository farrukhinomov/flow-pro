import type {
  ApiOnboardingStateDto,
  ApiOnboardingStepKey,
} from '@/contracts/api'
import {
  getAttendancePolicyConfigWorkflow,
  publishAttendancePolicyConfigWorkflow,
  shouldFallbackToLocalAttendancePolicy,
} from '@/data/api/attendance-policy.api'
import {
  claimWorkspace,
  completeOnboarding,
  getOnboardingState,
  getWorkspaceClaimState,
  resolveOnboardingStep,
  saveCompanyProfile,
} from '@/data/api/onboarding.api'
import { inviteUserWorkflow } from '@/data/api/users.api'
import { getAttendancePolicyConfig } from '@/data/local/attendance.repo'
import type { AttendancePolicyConfig } from '@/domain/attendance/types'
import type { UserRole } from '@/domain/users/types'

export type CompanyStepInput = {
  companyName: string
  countryCode?: string
  regionCode?: string
  timeZoneId: string
  weeklyHours: number
}

export type InviteRow = {
  email: string
  role: UserRole
}

export type InviteOutcome = {
  email: string
  error?: string
}

export type TeamStepResult = {
  invited: InviteOutcome[]
  failed: InviteOutcome[]
  onboarding: ApiOnboardingStateDto
}

/**
 * Orchestrates the setup wizard.
 *
 * The onboarding module owns progress only. Each step writes through the workflow that already
 * owns its data: the tenant profile through the onboarding API, the working-time and leave
 * configuration through the attendance policy, and invitations through the user directory. That
 * keeps onboarding from becoming a second source of truth for settings the product already has.
 */
export const onboardingWorkflow = {
  claimWorkspace: claimWorkspaceStep,
  completeOnboarding: completeOnboardingStep,
  getOnboardingState,
  getWorkspaceClaimState,
  resolveStep: resolveStepOnly,
  saveAbsencePolicy: saveAbsencePolicyStep,
  saveCompanyProfile: saveCompanyProfileStep,
  sendTeamInvites: sendTeamInvitesStep,
}

async function claimWorkspaceStep(workspaceName: string) {
  return claimWorkspace({ workspaceName })
}

async function saveCompanyProfileStep(input: CompanyStepInput) {
  const profile = await saveCompanyProfile(input)

  // Mirror the choice into the attendance policy so Today, Timesheet, Planning and Reports pick
  // up the country, region and target hours without a second setup pass.
  await patchAttendancePolicy((config) => ({
    ...config,
    countryCode: input.countryCode ?? config.countryCode,
    defaultWeeklyHours: input.weeklyHours,
    regionCode: input.regionCode ?? config.regionCode,
  }))

  return profile
}

async function sendTeamInvitesStep(rows: InviteRow[]): Promise<TeamStepResult> {
  const invited: InviteOutcome[] = []
  const failed: InviteOutcome[] = []

  for (const row of rows) {
    try {
      await inviteUserWorkflow({ email: row.email, role: row.role })
      invited.push({ email: row.email })
    } catch (error) {
      failed.push({
        email: row.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // The step still counts as done when some invites fail; the failures are surfaced in the UI so
  // the user can retry from the directory instead of being trapped in the wizard.
  const onboarding = await resolveOnboardingStep('team', {
    skipped: invited.length === 0,
  })

  return { failed, invited, onboarding }
}

async function saveAbsencePolicyStep(annualLeaveDays: number) {
  await patchAttendancePolicy((config) => ({
    ...config,
    vacationAnnualDays: annualLeaveDays,
  }))

  return resolveOnboardingStep('absences')
}

async function resolveStepOnly(
  step: ApiOnboardingStepKey,
  options: { skipped?: boolean } = {}
) {
  return resolveOnboardingStep(step, options)
}

async function completeOnboardingStep() {
  return completeOnboarding()
}

async function patchAttendancePolicy(
  patch: (config: AttendancePolicyConfig) => AttendancePolicyConfig
) {
  const current = await readAttendancePolicyConfig()
  const next = {
    ...patch(current),
    updatedAt: new Date().toISOString(),
  }

  await publishAttendancePolicyConfigWorkflow(next)

  return next
}

async function readAttendancePolicyConfig(): Promise<AttendancePolicyConfig> {
  try {
    return await getAttendancePolicyConfigWorkflow()
  } catch (error) {
    if (!shouldFallbackToLocalAttendancePolicy(error)) throw error
  }

  // A brand new workspace has never published a policy, so the local defaults are the baseline
  // the first publish is built from.
  return getAttendancePolicyConfig()
}
