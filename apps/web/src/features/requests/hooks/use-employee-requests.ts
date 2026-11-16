import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestWorkflow } from '@/application/request-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import { listAttendanceTypes } from '@/data/local/attendance.repo'
import {
  listAuditEventsForRequest,
  listEmployeeRequests,
} from '@/data/local/requests.repo'
import { listEmployeeUsers } from '@/data/local/users.repo'
import {
  readCurrentSyncMeta,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import {
  type AttendanceStatusType,
  type AttendancePolicyConfig,
  type SyncMeta,
} from '@/domain/attendance/types'
import { buildRequestApprovalFlow } from '@/domain/requests/approval-routing'
import type {
  AuditEvent,
  EmployeeRequest,
  RequestDecision,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { optionalSource } from '@/lib/optional-source'
import { useOptimisticList } from '@/hooks/use-optimistic-list'
import { useSession } from '@/features/access/session-provider'
import { applyDecisionToRequests } from '../request-view-model'

type SubmitDraft = Omit<RequestSubmissionDraft, 'employeeId' | 'employeeName'>

export function useEmployeeRequests() {
  const { session } = useSession()
  const { t } = useI18n()
  const actor = useMemo(
    () => ({
      displayName: session.displayName,
      employeeId: session.employeeId,
    }),
    [session.displayName, session.employeeId]
  )
  const [attendanceTypes, setAttendanceTypes] = useState<
    AttendanceStatusType[]
  >([])
  const [policyConfig, setPolicyConfig] = useState<AttendancePolicyConfig>(
    getDefaultAttendancePolicyConfig()
  )
  const {
    items: requests,
    replace: setRequests,
    run: runOptimistic,
  } = useOptimisticList<EmployeeRequest>()
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [
        nextAttendanceTypes,
        nextPolicyConfig,
        nextRequests,
        nextUsers,
        nextSyncMeta,
      ] = await Promise.all([
        optionalSource(listAttendanceTypes(), [], 'absence types'),
        optionalSource(
          getAttendancePolicyConfigBackendFirst(),
          () => getDefaultAttendancePolicyConfig(),
          'attendance policy'
        ),
        listEmployeeRequests(),
        optionalSource(
          listEmployeeUsersBackendFirst(),
          () => listEmployeeUsers(),
          'people'
        ),
        optionalSource(readCurrentSyncMeta(), null, 'sync status'),
      ])

      setAttendanceTypes(nextAttendanceTypes)
      setPolicyConfig(nextPolicyConfig)
      setRequests(nextRequests)
      setUsers(nextUsers)
      setSyncMeta(nextSyncMeta)
    } catch {
      setAttendanceTypes([])
      setPolicyConfig(getDefaultAttendancePolicyConfig())
      setRequests([])
      setUsers([])
      setSyncMeta(null)
    } finally {
      setIsLoading(false)
    }
  }, [setRequests])

  useEffect(() => {
    startAttendanceAutoSync()
    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)

    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
    }
  }, [refresh])

  const submitRequest = useCallback(
    async (draft: SubmitDraft) => {
      try {
        const employee = users.find((user) => user.id === actor.employeeId)
        const approvalFlow = buildRequestApprovalFlow({
          attendanceTypes,
          config: policyConfig,
          draft,
          employee,
          users,
        })
        const commands = await requestWorkflow.submitRequest({
          actor,
          draft: { ...draft, approvalFlow },
        })
        await refresh()
        toast.success(
          commands.length === 1
            ? t('requestsUi.requestSubmitted')
            : t('requestsUi.recurringRequestsSubmitted', {
                count: commands.length,
              })
        )
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'requestsUi.unableToSubmitRequest')
        )
      }
    },
    [actor, attendanceTypes, policyConfig, refresh, t, users]
  )

  const decideRequest = useCallback(
    async (id: string, decision: RequestDecision, comment?: string) => {
      try {
        // The row leaves the approval queue the moment the approver decides;
        // the refresh below replaces this with the server's own record.
        await runOptimistic(
          (current) => applyDecisionToRequests(current, [id], decision),
          () =>
            requestWorkflow.decideRequest({
              actor,
              comment,
              decision,
              id,
            })
        )
        await refresh()
        toast.success(
          decision === 'approve'
            ? t('requestsUi.requestApproved')
            : t('requestsUi.requestRejected')
        )
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'requestsUi.unableToDecideRequest')
        )
        throw error
      }
    },
    [actor, refresh, runOptimistic, t]
  )

  const decideRequests = useCallback(
    async (ids: string[], decision: RequestDecision, comment?: string) => {
      try {
        const commands = await runOptimistic(
          (current) => applyDecisionToRequests(current, ids, decision),
          () =>
            requestWorkflow.decideRequests({
              actor,
              comment,
              decision,
              ids,
            })
        )
        await refresh()
        toast.success(
          t(
            decision === 'approve'
              ? 'requestsUi.batchRequestsApproved'
              : 'requestsUi.batchRequestsRejected',
            { count: commands.length }
          )
        )
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'requestsUi.unableToDecideRequests')
        )
        throw error
      }
    },
    [actor, refresh, runOptimistic, t]
  )

  const approveAdjustedRequest = useCallback(
    async (
      id: string,
      adjustedDraft: RequestSubmissionDraft,
      comment?: string
    ) => {
      try {
        await requestWorkflow.approveAdjustedRequest({
          actor,
          adjustedDraft,
          comment,
          id,
        })
        await refresh()
        toast.success(t('requestsUi.adjustedRequestApproved'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            t,
            'requestsUi.unableToApproveAdjustedRequest'
          )
        )
        throw error
      }
    },
    [actor, refresh, t]
  )

  const loadAuditTrail = useCallback(
    async (id: string): Promise<AuditEvent[]> => listAuditEventsForRequest(id),
    []
  )

  const cancelRequest = useCallback(
    async (id: string) => {
      try {
        await runOptimistic(
          (current) =>
            current.map((request) =>
              request.id === id
                ? { ...request, status: 'cancelled' as const }
                : request
            ),
          () =>
            requestWorkflow.cancelRequest({
              actor,
              id,
            })
        )
        await refresh()
        toast.success(t('requestsUi.requestCancelled'))
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'requestsUi.unableToCancelRequest')
        )
      }
    },
    [actor, refresh, runOptimistic, t]
  )

  return {
    approveAdjustedRequest,
    attendanceTypes,
    cancelRequest,
    currentEmployeeId: session.employeeId,
    decideRequest,
    decideRequests,
    isLoading,
    loadAuditTrail,
    refresh,
    requests,
    submitRequest,
    syncMeta,
    users,
  }
}
