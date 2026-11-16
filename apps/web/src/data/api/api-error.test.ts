import { messages } from '@/i18n/messages'
import { hasMessage } from '@/i18n/resolve'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isAuthenticationError,
  isFlowProApiError,
  isPermissionError,
  resolveApiErrorMessage,
} from './api-error'
import { FlowProApiError } from './http-client'

/**
 * Every code the backend can put in a problem-details response, extracted from
 * the exception constructors in FlowPro.Application and FlowPro.Domain. If the
 * backend adds a code, add it here and add the two messages; the test below is
 * what stops a new code from silently degrading to generic copy.
 */
const BACKEND_ERROR_CODES = [
  'account.current_password_incorrect',
  'account.email_already_registered',
  'account.email_invalid',
  'account.email_rejected',
  'account.email_taken',
  'account.email_unchanged',
  'account.invitation_other_address',
  'account.password_rejected',
  'account.registration_disabled',
  'account.session_current',
  'account.session_not_found',
  'account.session_required',
  'account.shared_demo_account',
  'account.token_invalid',
  'account.two_factor_already_enabled',
  'account.two_factor_challenge_expired',
  'account.two_factor_code_invalid',
  'account.two_factor_not_enabled',
  'account.two_factor_setup_missing',
  'account.workspace_not_found',
  'approval-flow.assigned-to-another-approver',
  'approval-flow.current-step.invalid',
  'attachments.content-type-not-allowed',
  'attachments.empty-file',
  'attachments.file-name-required',
  'attachments.file-too-large',
  'attachments.metadata-invalid',
  'attachments.not-found',
  'attachments.object-not-found',
  'attachments.owner-required',
  'attachments.permission-required',
  'attachments.read-permission-required',
  'attendance.booking-already-voided',
  'attendance.booking-not-accessible',
  'attendance.clock-in.invalid-state',
  'attendance.clock-out.invalid-state',
  'attendance.correction-reason.invalid',
  'attendance.device-sequence.invalid',
  'attendance.event-before-current-state',
  'attendance.geo.accuracy-invalid',
  'attendance.geo.incomplete',
  'attendance.geo.invalid',
  'attendance.invalid-range',
  'attendance.occurred-at-in-future',
  'attendance.range-too-large',
  'attendance.resume-work.invalid-state',
  'attendance.start-break.invalid-state',
  'attendance.state-missing',
  'employee.not-active',
  'idempotency-key.invalid',
  'idempotency-key.reused',
  'payroll.format.invalid',
  'payroll.period.required',
  'request.attachment.too-large',
  'request.booking-correction.empty',
  'request.date-range.invalid',
  'request.kind.invalid',
  'request.not-found',
  'request.not-submitted',
  'request.partial-day.invalid',
  'request.payload.invalid',
  'request.recurrence.invalid',
  'request.status-type.required',
  'request.subtype.required',
  'sync.aggregate.required',
  'sync.batch.too-large',
  'sync.client-id.required',
  'sync.cursor.invalid',
  'sync.protocol.invalid',
  'timesheet.period.invalid',
  'user.invitation_not_open',
  'user.shared_demo_login',
] as const

const t = (key: string) => {
  const path = key.split('.')
  let current: unknown = messages.en

  for (const segment of path) {
    if (!current || typeof current !== 'object') return key
    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' ? current : key
}

describe('api error resolution', () => {
  it('has an English message for every backend error code', () => {
    const missing = BACKEND_ERROR_CODES.filter(
      (code) => !hasMessage('en', `apiErrors.${code}`)
    )

    assert.deepEqual(missing, [], 'every backend code needs a message')
  })

  it('has a German message for every backend error code', () => {
    const missing = BACKEND_ERROR_CODES.filter(
      (code) => !hasMessage('de', `apiErrors.${code}`)
    )

    assert.deepEqual(missing, [], 'every backend code needs German copy')
  })

  it('prefers the code-specific message over the caller fallback', () => {
    const error = new FlowProApiError(
      'Cannot execute clock-in while attendance state is Working.',
      'attendance.clock-in.invalid-state',
      409
    )

    assert.equal(
      resolveApiErrorMessage(error, t, 'todayUi.unableToBookTime'),
      'You can only clock in before work has started.'
    )
  })

  it('falls back to the caller key for an unmapped code', () => {
    const error = new FlowProApiError('boom', 'something.brand-new', 400)

    assert.equal(
      resolveApiErrorMessage(error, t, 'todayUi.unableToBookTime'),
      t('todayUi.unableToBookTime')
    )
  })

  it('never surfaces raw infrastructure codes or server detail to the user', () => {
    for (const code of [
      'api.request-failed',
      'concurrency.conflict',
      'server.unexpected',
    ]) {
      const message = resolveApiErrorMessage(
        new FlowProApiError('internal stack detail', code, 500),
        t,
        'todayUi.unableToBookTime'
      )

      assert.ok(!message.includes(code), `${code} must not leak`)
      assert.ok(
        !message.includes('internal stack detail'),
        'server detail must not leak'
      )
      // A 5xx resolves through the status ladder, which is more actionable
      // than the caller's action-specific fallback.
      assert.equal(message, t('apiErrors.status.unavailable'))
    }
  })

  it('maps 401 and 403 ahead of the caller fallback', () => {
    assert.equal(
      resolveApiErrorMessage(
        new FlowProApiError('x', 'api.request-failed', 401),
        t,
        'usersUi.unableSaveEmployee'
      ),
      t('errorsUi.sessionExpired')
    )
    assert.equal(
      resolveApiErrorMessage(
        new FlowProApiError('x', 'api.request-failed', 403),
        t,
        'usersUi.unableSaveEmployee'
      ),
      t('errorsUi.forbidden')
    )
  })

  it('prefers caller-supplied status copy when provided', () => {
    const error = new FlowProApiError('x', 'api.request-failed', 409)

    assert.equal(
      resolveApiErrorMessage(error, t, 'todayUi.unableToBookTime', {
        conflict: 'todayUi.mutationErrors.conflict',
      }),
      t('todayUi.mutationErrors.conflict')
    )
    // Without an override there is no generic 409 copy, so the caller's
    // action-specific fallback wins.
    assert.equal(
      resolveApiErrorMessage(error, t, 'todayUi.unableToBookTime'),
      t('todayUi.unableToBookTime')
    )
  })

  it('uses a local error message when the fallback key is unknown', () => {
    assert.equal(
      resolveApiErrorMessage(new Error('local failure'), t, 'no.such.key'),
      'local failure'
    )
  })

  it('classifies auth and permission failures by status', () => {
    const unauthorized = new FlowProApiError(
      'x',
      'authentication.required',
      401
    )
    const forbidden = new FlowProApiError('x', 'attendance.clock.self', 403)

    assert.ok(isFlowProApiError(unauthorized))
    assert.ok(isAuthenticationError(unauthorized))
    assert.ok(!isPermissionError(unauthorized))
    assert.ok(isPermissionError(forbidden))
    assert.ok(!isAuthenticationError(forbidden))
    assert.ok(!isFlowProApiError(new Error('plain')))
  })
})
