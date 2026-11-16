import { FlowProApiError } from '@/data/api/http-client'
import {
  adjustAndApproveRequestWorkflow,
  cancelRequestWorkflow,
  decideRequestWorkflow,
  submitRequestWorkflow,
  type ApiRequestWorkflowResult,
} from '@/data/api/request-workflows.api'
import { upsertTimeCorrection } from '@/data/local/attendance.repo'
import {
  getEmployeeRequest,
  saveEmployeeRequestCommand,
  updateEmployeeRequest,
} from '@/data/local/requests.repo'
import { saveWorkflowSideEffect } from '@/data/local/workflow-side-effects.repo'
import {
  notifyLocalDataChanged,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import { createAppliedTimeCorrectionFromRequest } from '@/domain/attendance/corrections'
import {
  createRequestAdjustAndApproveCommands,
  createRequestCancelCommand,
  createRequestDecisionCommand,
  createRequestSubmitCommands,
} from '@/domain/requests/commands'
import type {
  EmployeeRequest,
  RequestCommandResult,
  RequestDecision,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import { runLocalWriteEffects, type LocalWriteEffects } from './sync-effects'

export type RequestWorkflowDependencies = LocalWriteEffects & {
  getEmployeeRequest: typeof getEmployeeRequest
  saveEmployeeRequestCommand: typeof saveEmployeeRequestCommand
  saveServerEmployeeRequest?: typeof updateEmployeeRequest
  saveServerWorkflowSideEffect?: typeof saveWorkflowSideEffect
  server?: {
    adjustAndApproveRequest: typeof adjustAndApproveRequestWorkflow
    cancelRequest: typeof cancelRequestWorkflow
    decideRequest: typeof decideRequestWorkflow
    submitRequest: typeof submitRequestWorkflow
  }
  upsertTimeCorrection: typeof upsertTimeCorrection
}

export type RequestActor = {
  employeeId: string
  displayName: string
}

export type SubmitRequestInput = {
  actor: RequestActor
  draft: Omit<RequestSubmissionDraft, 'employeeId' | 'employeeName'>
}

export type DecideRequestInput = {
  actor: RequestActor
  id: string
  decision: RequestDecision
  comment?: string
}

export type DecideRequestsInput = Omit<DecideRequestInput, 'id'> & {
  ids: string[]
}

export type ApproveAdjustedRequestInput = {
  actor: RequestActor
  id: string
  adjustedDraft: RequestSubmissionDraft
  comment?: string
}

export type CancelRequestInput = {
  actor: RequestActor
  id: string
}

const defaultDependencies: RequestWorkflowDependencies = {
  getEmployeeRequest,
  notifyLocalDataChanged,
  saveEmployeeRequestCommand,
  saveServerEmployeeRequest: updateEmployeeRequest,
  saveServerWorkflowSideEffect: saveWorkflowSideEffect,
  server: {
    adjustAndApproveRequest: adjustAndApproveRequestWorkflow,
    cancelRequest: cancelRequestWorkflow,
    decideRequest: decideRequestWorkflow,
    submitRequest: submitRequestWorkflow,
  },
  syncAttendanceOutbox,
  upsertTimeCorrection,
}

function shouldFallbackToLocal(error: unknown) {
  if (!(error instanceof FlowProApiError)) return false

  return error.status === undefined || error.status >= 500
}

function shouldFallbackForLocalOnlyRequest(
  error: unknown,
  request: EmployeeRequest
) {
  return (
    shouldFallbackToLocal(error) ||
    (error instanceof FlowProApiError &&
      error.status === 404 &&
      request.syncState !== 'synced')
  )
}

function createClientOperationId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

async function saveServerRequestResult(
  result: ApiRequestWorkflowResult<EmployeeRequest>,
  dependencies: RequestWorkflowDependencies
) {
  if (!dependencies.saveServerEmployeeRequest) {
    throw new Error('Server request persistence dependency is not configured.')
  }

  await dependencies.saveServerEmployeeRequest({
    ...result.primary.payload,
    syncState: 'synced',
  })

  if (dependencies.saveServerWorkflowSideEffect) {
    for (const sideEffect of result.sideEffects) {
      await dependencies.saveServerWorkflowSideEffect(sideEffect)
    }
  }

  await dependencies.notifyLocalDataChanged()
}

export function createRequestWorkflowService(
  dependencies: RequestWorkflowDependencies = defaultDependencies
) {
  async function saveCommands(commands: RequestCommandResult[]) {
    await Promise.all(commands.map(dependencies.saveEmployeeRequestCommand))

    for (const command of commands) {
      if (
        command.request.status === 'approved' &&
        command.request.kind === 'booking-correction'
      ) {
        await dependencies.upsertTimeCorrection(
          createAppliedTimeCorrectionFromRequest(command.request)
        )
      }
    }

    await runLocalWriteEffects(dependencies)
  }

  async function getSubmittedRequest(id: string): Promise<EmployeeRequest> {
    const request = await dependencies.getEmployeeRequest(id)

    if (!request) throw new Error('Request was not found.')

    return request
  }

  return {
    async submitRequest({ actor, draft }: SubmitRequestInput) {
      const commands = createRequestSubmitCommands({
        draft: {
          ...draft,
          employeeId: actor.employeeId,
          employeeName: actor.displayName,
        },
      })

      if (dependencies.server) {
        try {
          for (const command of commands) {
            await saveServerRequestResult(
              await dependencies.server.submitRequest({
                clientOperationId: createClientOperationId('request-submit'),
                request: command.request,
              }),
              dependencies
            )
          }

          return commands
        } catch (error) {
          if (!shouldFallbackToLocal(error)) throw error
        }
      }

      await saveCommands(commands)

      return commands
    },

    async decideRequest({ actor, comment, decision, id }: DecideRequestInput) {
      const request = await getSubmittedRequest(id)
      const command = createRequestDecisionCommand({
        actorId: actor.employeeId,
        actorName: actor.displayName,
        comment,
        decision,
        request,
      })

      if (dependencies.server) {
        try {
          await saveServerRequestResult(
            await dependencies.server.decideRequest({
              clientOperationId: createClientOperationId('request-decision'),
              comment,
              decision,
              requestId: id,
            }),
            dependencies
          )

          return command
        } catch (error) {
          if (!shouldFallbackForLocalOnlyRequest(error, request)) throw error
        }
      }

      await saveCommands([command])

      return command
    },

    async decideRequests({
      actor,
      comment,
      decision,
      ids,
    }: DecideRequestsInput) {
      const commands = []

      for (const id of ids) {
        const request = await getSubmittedRequest(id)

        commands.push(
          createRequestDecisionCommand({
            actorId: actor.employeeId,
            actorName: actor.displayName,
            comment,
            decision,
            request,
          })
        )
      }

      if (dependencies.server) {
        try {
          for (const command of commands) {
            await saveServerRequestResult(
              await dependencies.server.decideRequest({
                clientOperationId: createClientOperationId('request-decision'),
                comment,
                decision,
                requestId: command.request.id,
              }),
              dependencies
            )
          }

          return commands
        } catch (error) {
          const canFallback = await Promise.all(
            ids.map(async (id) => {
              const request = await dependencies.getEmployeeRequest(id)

              return (
                !!request && shouldFallbackForLocalOnlyRequest(error, request)
              )
            })
          )

          if (!canFallback.every(Boolean)) throw error
        }
      }

      await saveCommands(commands)

      return commands
    },

    async approveAdjustedRequest({
      actor,
      adjustedDraft,
      comment,
      id,
    }: ApproveAdjustedRequestInput) {
      const request = await getSubmittedRequest(id)
      const commands = createRequestAdjustAndApproveCommands({
        adjustedDraft,
        actorId: actor.employeeId,
        actorName: actor.displayName,
        comment,
        request,
      })

      if (dependencies.server) {
        try {
          const adjusted = commands.find(
            (command) => command.request.status === 'approved'
          )

          if (!adjusted) {
            throw new Error('Adjusted approval command was not created.')
          }

          await saveServerRequestResult(
            await dependencies.server.adjustAndApproveRequest({
              adjustedRequest: adjusted.request,
              clientOperationId: createClientOperationId(
                'request-adjust-approve'
              ),
              comment,
              requestId: id,
            }),
            dependencies
          )

          return commands
        } catch (error) {
          if (!shouldFallbackForLocalOnlyRequest(error, request)) throw error
        }
      }

      await saveCommands(commands)

      return commands
    },

    async cancelRequest({ actor, id }: CancelRequestInput) {
      const request = await getSubmittedRequest(id)
      const command = createRequestCancelCommand({
        actorId: actor.employeeId,
        actorName: actor.displayName,
        request,
      })

      if (dependencies.server) {
        try {
          await saveServerRequestResult(
            await dependencies.server.cancelRequest({
              clientOperationId: createClientOperationId('request-cancel'),
              requestId: id,
            }),
            dependencies
          )

          return command
        } catch (error) {
          if (!shouldFallbackForLocalOnlyRequest(error, request)) throw error
        }
      }

      await saveCommands([command])

      return command
    },
  }
}

export const requestWorkflow = createRequestWorkflowService()
