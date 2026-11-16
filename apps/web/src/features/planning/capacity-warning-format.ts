type Translator = (
  key: string,
  vars?: Record<string, string | number>
) => string

const BELOW_MINIMUM_PATTERN = /^(.+) is below minimum staffing: (\d+)\/(\d+)\.$/
const ONSITE_PATTERN = /^(.+) has (\d+)\/(\d+) required on-site staff\.$/

export function formatCapacityWarning(warning: string, t: Translator) {
  const belowMinimum = warning.match(BELOW_MINIMUM_PATTERN)
  if (belowMinimum) {
    return t('planningUi.belowMinimumStaffingSentence', {
      team: belowMinimum[1],
      current: belowMinimum[2],
      minimum: belowMinimum[3],
    })
  }

  const onsite = warning.match(ONSITE_PATTERN)
  if (onsite) {
    return t('planningUi.requiredOnsiteStaffSentence', {
      team: onsite[1],
      current: onsite[2],
      minimum: onsite[3],
    })
  }

  return warning
}
