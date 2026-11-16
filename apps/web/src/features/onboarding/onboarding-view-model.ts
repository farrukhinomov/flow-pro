import type {
  ApiOnboardingStateDto,
  ApiOnboardingStepKey,
} from '@/contracts/api'

export const ONBOARDING_STEP_ORDER = [
  'company',
  'team',
  'absences',
  'first-clock-in',
] as const satisfies readonly ApiOnboardingStepKey[]

/**
 * Only the company step gathers information the product cannot work without. Everything else can
 * be completed later from settings, so the wizard always offers a way past it.
 */
const REQUIRED_STEPS: readonly ApiOnboardingStepKey[] = ['company']

export type OnboardingStepStatus = 'done' | 'skipped' | 'current' | 'upcoming'

export type OnboardingWizardStep = {
  key: ApiOnboardingStepKey
  index: number
  isOptional: boolean
  status: OnboardingStepStatus
  titleKey: string
  descriptionKey: string
}

export function isOnboardingComplete(
  state: ApiOnboardingStateDto | null
): boolean {
  return state?.status === 'completed'
}

export function isStepResolved(
  state: ApiOnboardingStateDto | null,
  step: ApiOnboardingStepKey
): boolean {
  return (
    state?.steps.some((item) => item.step === step && item.resolved) ?? false
  )
}

/**
 * Picks the step to display. An explicitly requested step wins so the user can navigate back, but
 * only if it is a real step; otherwise the first unresolved step is used.
 */
export function getActiveStep(
  state: ApiOnboardingStateDto | null,
  requestedStep?: string | null
): ApiOnboardingStepKey {
  if (isOnboardingStepKey(requestedStep)) return requestedStep

  const currentStep = state?.currentStep

  if (isOnboardingStepKey(currentStep)) return currentStep

  const firstUnresolved = ONBOARDING_STEP_ORDER.find(
    (step) => !isStepResolved(state, step)
  )

  return firstUnresolved ?? ONBOARDING_STEP_ORDER[0]
}

export function getWizardSteps(
  state: ApiOnboardingStateDto | null,
  activeStep: ApiOnboardingStepKey
): OnboardingWizardStep[] {
  return ONBOARDING_STEP_ORDER.map((key, index) => {
    const record = state?.steps.find((item) => item.step === key)
    const status: OnboardingStepStatus =
      key === activeStep
        ? 'current'
        : record?.resolved
          ? record.skipped
            ? 'skipped'
            : 'done'
          : 'upcoming'

    return {
      descriptionKey: `onboardingUi.steps.${toCamelCase(key)}.description`,
      index,
      isOptional: !REQUIRED_STEPS.includes(key),
      key,
      status,
      titleKey: `onboardingUi.steps.${toCamelCase(key)}.title`,
    }
  })
}

export function getProgressPercent(
  state: ApiOnboardingStateDto | null
): number {
  if (isOnboardingComplete(state)) return 100

  const resolved = ONBOARDING_STEP_ORDER.filter((step) =>
    isStepResolved(state, step)
  ).length

  return Math.round((resolved / ONBOARDING_STEP_ORDER.length) * 100)
}

export function getNextStep(
  step: ApiOnboardingStepKey
): ApiOnboardingStepKey | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(step)

  return ONBOARDING_STEP_ORDER[index + 1] ?? null
}

export function getPreviousStep(
  step: ApiOnboardingStepKey
): ApiOnboardingStepKey | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(step)

  return index > 0 ? (ONBOARDING_STEP_ORDER[index - 1] ?? null) : null
}

export function isOnboardingStepKey(
  value: unknown
): value is ApiOnboardingStepKey {
  return (
    typeof value === 'string' &&
    (ONBOARDING_STEP_ORDER as readonly string[]).includes(value)
  )
}

export type CountryOption = {
  code: string
  labelKey: string
  defaultTimeZoneId: string
}

/**
 * DACH first: FlowPro's compliance model is built around the German Arbeitszeitgesetz, and public
 * holidays there are set per Bundesland, which is why regions are modelled at all.
 */
export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: 'DE', defaultTimeZoneId: 'Europe/Berlin', labelKey: 'countries.DE' },
  { code: 'AT', defaultTimeZoneId: 'Europe/Vienna', labelKey: 'countries.AT' },
  { code: 'CH', defaultTimeZoneId: 'Europe/Zurich', labelKey: 'countries.CH' },
]

const REGIONS_BY_COUNTRY: Record<string, readonly string[]> = {
  AT: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  CH: [
    'AG',
    'AI',
    'AR',
    'BE',
    'BL',
    'BS',
    'FR',
    'GE',
    'GL',
    'GR',
    'JU',
    'LU',
    'NE',
    'NW',
    'OW',
    'SG',
    'SH',
    'SO',
    'SZ',
    'TG',
    'TI',
    'UR',
    'VD',
    'VS',
    'ZG',
    'ZH',
  ],
  DE: [
    'BW',
    'BY',
    'BE',
    'BB',
    'HB',
    'HH',
    'HE',
    'MV',
    'NI',
    'NW',
    'RP',
    'SL',
    'SN',
    'ST',
    'SH',
    'TH',
  ],
}

export type RegionOption = {
  code: string
  labelKey: string
}

export function getRegionOptions(countryCode: string | null): RegionOption[] {
  const regions = REGIONS_BY_COUNTRY[countryCode ?? ''] ?? []

  return regions.map((region) => ({
    code: `${countryCode}-${region}`,
    labelKey: `regions.${countryCode}-${region}`,
  }))
}

export function getDefaultTimeZoneForCountry(countryCode: string | null) {
  return (
    COUNTRY_OPTIONS.find((country) => country.code === countryCode)
      ?.defaultTimeZoneId ?? 'Europe/Berlin'
  )
}

export const MIN_WEEKLY_HOURS = 1
/**
 * The Arbeitszeitgesetz caps the average working week at 48 hours, with 60 as the hard ceiling.
 * The backend rejects anything higher, so the form refuses it before the round trip.
 */
export const MAX_WEEKLY_HOURS = 60

export type WeeklyHoursValidation =
  { ok: true; value: number } | { ok: false; messageKey: string }

export function validateWeeklyHours(input: string): WeeklyHoursValidation {
  const normalized = input.trim().replace(',', '.')
  const parsed = Number(normalized)

  if (normalized.length === 0 || !Number.isFinite(parsed)) {
    return { messageKey: 'onboardingUi.errors.weeklyHoursRequired', ok: false }
  }

  if (parsed < MIN_WEEKLY_HOURS || parsed > MAX_WEEKLY_HOURS) {
    return { messageKey: 'onboardingUi.errors.weeklyHoursRange', ok: false }
  }

  return { ok: true, value: Math.round(parsed * 100) / 100 }
}

export type ParsedInvites = {
  valid: string[]
  invalid: string[]
}

/**
 * Accepts the shapes people actually paste: newline, comma, semicolon, or space separated.
 * Duplicates are collapsed so the invite step never sends the same address twice.
 */
export function parseInviteEmails(raw: string): ParsedInvites {
  const candidates = raw
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)

    if (isEmailAddress(candidate)) {
      valid.push(candidate)
    } else {
      invalid.push(candidate)
    }
  }

  return { invalid, valid }
}

function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

/**
 * Statutory minimum paid leave, expressed in days for a five-day working week.
 * Germany: 24 Werktage on a six-day week, which is 20 on a five-day week.
 */
export function getDefaultAnnualLeaveDays(countryCode: string | null): number {
  switch (countryCode) {
    case 'AT':
      return 25
    case 'CH':
      return 20
    case 'DE':
    default:
      return 20
  }
}

export const MIN_ANNUAL_LEAVE_DAYS = 0
export const MAX_ANNUAL_LEAVE_DAYS = 60

export type AnnualLeaveValidation =
  { ok: true; value: number } | { ok: false; messageKey: string }

export function validateAnnualLeaveDays(input: string): AnnualLeaveValidation {
  const normalized = input.trim().replace(',', '.')
  const parsed = Number(normalized)

  if (normalized.length === 0 || !Number.isFinite(parsed)) {
    return { messageKey: 'onboardingUi.errors.leaveDaysRequired', ok: false }
  }

  if (parsed < MIN_ANNUAL_LEAVE_DAYS || parsed > MAX_ANNUAL_LEAVE_DAYS) {
    return { messageKey: 'onboardingUi.errors.leaveDaysRange', ok: false }
  }

  return { ok: true, value: Math.round(parsed * 2) / 2 }
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
  } catch {
    return 'Europe/Berlin'
  }
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase()
  )
}
