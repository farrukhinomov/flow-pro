import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
} from '@/domain/attendance/types'
import type { EmployeeUser } from '@/domain/users/types'
import type {
  RequestApprovalFlow,
  RequestApprovalStep,
  RequestSubmissionDraft,
} from './types'

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function makeStep(
  id: string,
  label: string,
  approvers: EmployeeUser[],
  requireAll = false
): RequestApprovalStep | null {
  const active = approvers.filter((user) => user.status === 'active')
  if (active.length === 0) return null

  return {
    id,
    label,
    approverIds: active.map((user) => user.id),
    approverNames: active.map((user) => `${user.firstName} ${user.lastName}`),
    requireAll,
    status: 'pending',
    decisions: [],
  }
}

export function buildRequestApprovalFlow({
  attendanceTypes,
  config,
  draft,
  employee,
  users,
}: {
  attendanceTypes: AttendanceStatusType[]
  config: AttendancePolicyConfig
  draft: Pick<
    RequestSubmissionDraft,
    'kind' | 'statusTypeId' | 'statusCode' | 'correctionDeltaMinutes'
  >
  employee?: EmployeeUser
  users: EmployeeUser[]
}): RequestApprovalFlow {
  const statusType =
    attendanceTypes.find((type) => type.id === draft.statusTypeId) ??
    attendanceTypes.find((type) => type.code === draft.statusCode)
  const autoApproved =
    (draft.kind === 'booking-correction' &&
      config.approvalRules.autoApproveBookingCorrections &&
      typeof draft.correctionDeltaMinutes === 'number' &&
      draft.correctionDeltaMinutes <=
        config.approvalRules.autoApproveBookingCorrectionThresholdMinutes) ||
    (draft.kind === 'absence' &&
      statusType?.requiresApproval === false &&
      config.approvalRules.autoApproveNonRequiredAbsences)

  if (autoApproved) {
    return { autoApproved: true, currentStepIndex: 0, steps: [] }
  }

  const primaryLead = employee
    ? users.find(
        (user) =>
          normalizeName(`${user.firstName} ${user.lastName}`) ===
          normalizeName(employee.manager)
      )
    : undefined
  const leadStep = makeStep(
    'team-lead',
    'Team lead',
    primaryLead ? [primaryLead] : []
  )
  const primaryManager = primaryLead
    ? users.find(
        (user) =>
          normalizeName(`${user.firstName} ${user.lastName}`) ===
          normalizeName(primaryLead.manager)
      )
    : undefined
  const managementStep = makeStep(
    'manager',
    'Manager',
    primaryManager && primaryManager.id !== primaryLead?.id
      ? [primaryManager]
      : users.filter(
          (user) =>
            user.role === 'manager' &&
            user.team === employee?.team &&
            user.id !== primaryLead?.id
        )
  )
  const hrStep = makeStep(
    'hr',
    'HR',
    users.filter((user) => user.role === 'hr')
  )
  const adminStep = makeStep(
    'admin',
    'Administrator',
    users.filter((user) => user.role === 'superadmin')
  )
  const needsEscalation =
    draft.kind === 'absence' &&
    (statusType?.category === 'leave' || statusType?.category === 'remote')
  const steps = [
    leadStep,
    ...(needsEscalation ? [managementStep ?? hrStep] : []),
  ].filter((step): step is RequestApprovalStep => !!step)

  if (steps.length === 0) {
    const fallbackStep = hrStep ?? adminStep
    if (fallbackStep) steps.push(fallbackStep)
  }

  return {
    currentStepIndex: 0,
    steps,
  }
}

export function getCurrentApprovalStep(flow?: RequestApprovalFlow) {
  return flow?.steps[flow.currentStepIndex]
}
