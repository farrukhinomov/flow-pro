import { FlowProApiError } from '@/data/api/http-client'
import { createPayrollExportWorkflow } from '@/data/api/request-workflows.api'
import {
  markTimesheetExportedWorkflow,
  signTimesheetApprovalWorkflow,
  shouldFallbackToLocalTimesheet,
} from '@/data/api/timesheet.api'
import {
  cacheTimesheetApproval,
  markTimesheetExported,
  signTimesheetApproval,
} from '@/data/local/timesheet.repo'
import { saveWorkflowSideEffect } from '@/data/local/workflow-side-effects.repo'
import {
  notifyLocalDataChanged,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import type { PayrollExport } from '@/domain/timesheet/exports'
import { runLocalWriteEffects, type LocalWriteEffects } from './sync-effects'

export type TimesheetWorkflowDependencies = LocalWriteEffects & {
  cacheTimesheetApproval: typeof cacheTimesheetApproval
  createPayrollExportWorkflow: typeof createPayrollExportWorkflow
  markTimesheetExported: typeof markTimesheetExported
  markTimesheetExportedWorkflow: typeof markTimesheetExportedWorkflow
  saveServerWorkflowSideEffect: typeof saveWorkflowSideEffect
  signTimesheetApproval: typeof signTimesheetApproval
  signTimesheetApprovalWorkflow: typeof signTimesheetApprovalWorkflow
  shouldFallbackToLocalTimesheet: typeof shouldFallbackToLocalTimesheet
}

export type SignTimesheetInput = Parameters<typeof signTimesheetApproval>[0] & {
  snapshot?: Pick<PayrollExport, 'rows' | 'totals'>
}

export type MarkTimesheetExportedInput = {
  approval: MonthlyTimesheetApproval
  format?: 'DATEV' | 'Excel' | 'Personio'
  kind: 'payroll' | 'pdf'
  scope?: string
}

const defaultDependencies: TimesheetWorkflowDependencies = {
  cacheTimesheetApproval,
  createPayrollExportWorkflow,
  markTimesheetExportedWorkflow,
  markTimesheetExported,
  notifyLocalDataChanged,
  saveServerWorkflowSideEffect: saveWorkflowSideEffect,
  signTimesheetApproval,
  signTimesheetApprovalWorkflow,
  shouldFallbackToLocalTimesheet,
  syncAttendanceOutbox,
}

function shouldFallbackToLocal(error: unknown) {
  if (!(error instanceof FlowProApiError)) return false

  return error.status === undefined || error.status >= 500
}

function createClientOperationId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

export function createTimesheetWorkflowService(
  dependencies: TimesheetWorkflowDependencies = defaultDependencies
) {
  return {
    async signMonthlyTimesheet(input: SignTimesheetInput) {
      try {
        const approval = await dependencies.signTimesheetApprovalWorkflow(input)
        await dependencies.cacheTimesheetApproval(approval)
        await dependencies.notifyLocalDataChanged()
        return approval
      } catch (error) {
        if (!dependencies.shouldFallbackToLocalTimesheet(error)) throw error
      }

      const { snapshot: _snapshot, ...localInput } = input
      const approval = await dependencies.signTimesheetApproval(localInput)

      await runLocalWriteEffects(dependencies)

      return approval
    },

    async markExported({
      approval,
      format = 'DATEV',
      kind,
      scope,
    }: MarkTimesheetExportedInput) {
      if (kind === 'payroll') {
        try {
          const result = await dependencies.createPayrollExportWorkflow({
            clientOperationId: createClientOperationId('payroll-export'),
            format,
            period: approval.periodMonth,
            scope: scope ?? approval.employeeId,
          })

          await dependencies.saveServerWorkflowSideEffect(result.primary)
          await Promise.all(
            result.sideEffects.map((item) =>
              dependencies.saveServerWorkflowSideEffect(item)
            )
          )
          await dependencies.notifyLocalDataChanged()
        } catch (error) {
          if (!shouldFallbackToLocal(error)) throw error
        }
      }

      try {
        const nextApproval = await dependencies.markTimesheetExportedWorkflow({
          employeeId: approval.employeeId,
          kind,
          periodMonth: approval.periodMonth,
        })
        await dependencies.cacheTimesheetApproval(nextApproval)
        await dependencies.notifyLocalDataChanged()
        return nextApproval
      } catch (error) {
        if (!dependencies.shouldFallbackToLocalTimesheet(error)) throw error
      }

      const nextApproval = await dependencies.markTimesheetExported(
        approval,
        kind
      )

      await runLocalWriteEffects(dependencies)

      return nextApproval
    },
  }
}

export const timesheetWorkflow = createTimesheetWorkflowService()
