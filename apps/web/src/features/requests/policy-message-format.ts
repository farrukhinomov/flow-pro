import type { RequestPolicyIssue } from '@/domain/requests/policy'

type Translator = (
  key: string,
  vars?: Record<string, string | number>
) => string

const VACATION_BALANCE_PATTERN =
  /^This request needs ([\d.]+) vacation days, but only ([\d.]+) are available\.$/
const HOME_OFFICE_LIMIT_PATTERN =
  /^Home office would reach ([\d.]+) days in ([^;]+); policy target is ([\d.]+)\.$/

export function formatRequestPolicyIssue(
  issue: RequestPolicyIssue,
  t: Translator
) {
  if (issue.code === 'invalid-date-range') {
    return t('requestsUi.policyInvalidDateRange')
  }

  if (issue.code === 'invalid-partial-day') {
    return t('requestsUi.policyInvalidPartialDay')
  }

  if (issue.code === 'own-request-conflict') {
    return t('requestsUi.policyOwnRequestConflict')
  }

  if (issue.code === 'team-coverage') {
    return t('requestsUi.policyTeamCoverage')
  }

  if (issue.code === 'vacation-balance') {
    const match = issue.message.match(VACATION_BALANCE_PATTERN)
    if (match) {
      return t('requestsUi.policyVacationBalance', {
        requested: match[1],
        available: match[2],
      })
    }
  }

  if (issue.code === 'home-office-limit') {
    const match = issue.message.match(HOME_OFFICE_LIMIT_PATTERN)
    if (match) {
      return t('requestsUi.policyHomeOfficeLimit', {
        days: match[1],
        month: match[2],
        target: match[3],
      })
    }
  }

  return issue.message
}
