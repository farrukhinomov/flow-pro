import type { RequestPolicyEvaluation } from '@/domain/requests/policy'
import { useI18n } from '@/i18n'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { formatRequestPolicyIssue } from '../../policy-message-format'

export function RequestPolicyWarnings({
  policy,
}: {
  policy: RequestPolicyEvaluation
}) {
  const { t } = useI18n()
  if (policy.blocking.length === 0 && policy.warnings.length === 0) return null

  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium'>{t('requestsUi.policyCheck')}</div>
      {policy.blocking.map((issue) => (
        <div
          key={issue.code}
          className='rounded-md border border-rose-200 bg-rose-500/10 p-3 text-sm leading-6 text-rose-700 dark:border-rose-900 dark:text-rose-300'
        >
          <div className='mb-1 flex items-center gap-2 font-medium'>
            <ShieldAlert className='h-4 w-4' />
            {t('requestsUi.policyBlockLabel')}
          </div>
          {formatRequestPolicyIssue(issue, t)}
        </div>
      ))}
      {policy.warnings.map((issue) => (
        <div
          key={issue.code}
          className='rounded-md border border-amber-200 bg-amber-500/10 p-3 text-sm leading-6 text-amber-700 dark:border-amber-900 dark:text-amber-300'
        >
          <div className='mb-1 flex items-center gap-2 font-medium'>
            <AlertTriangle className='h-4 w-4' />
            {t('requestsUi.managerWarning')}
          </div>
          {formatRequestPolicyIssue(issue, t)}
        </div>
      ))}
    </div>
  )
}
