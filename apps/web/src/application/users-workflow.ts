import {
  deactivateUserWorkflow,
  inviteUserWorkflow,
  reactivateUserWorkflow,
  saveUserWorkflow,
  shouldFallbackToLocalUsers,
} from '@/data/api/users.api'
import {
  cacheEmployeeUser,
  deactivateEmployeeUser,
  inviteEmployeeUser,
  reactivateEmployeeUser,
  upsertEmployeeUser,
} from '@/data/local/users.repo'
import {
  notifyLocalDataChanged,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { runBackendFirstWrite } from './backend-first-workflow'
import { runLocalWriteEffects, type LocalWriteEffects } from './sync-effects'

export type UsersWorkflowDependencies = LocalWriteEffects & {
  cacheEmployeeUser: typeof cacheEmployeeUser
  deactivateUserWorkflow: typeof deactivateUserWorkflow
  deactivateEmployeeUser: typeof deactivateEmployeeUser
  inviteUserWorkflow: typeof inviteUserWorkflow
  inviteEmployeeUser: typeof inviteEmployeeUser
  reactivateUserWorkflow: typeof reactivateUserWorkflow
  reactivateEmployeeUser: typeof reactivateEmployeeUser
  saveUserWorkflow: typeof saveUserWorkflow
  shouldFallbackToLocalUsers: typeof shouldFallbackToLocalUsers
  upsertEmployeeUser: typeof upsertEmployeeUser
}

export type InviteUserInput = {
  email: string
  note?: string
  role: UserRole
}

export type DeactivateUserInput = {
  actorId?: string
  reason?: string
  user: EmployeeUser
}

const defaultDependencies: UsersWorkflowDependencies = {
  cacheEmployeeUser,
  deactivateUserWorkflow,
  deactivateEmployeeUser,
  inviteUserWorkflow,
  inviteEmployeeUser,
  notifyLocalDataChanged,
  reactivateUserWorkflow,
  reactivateEmployeeUser,
  saveUserWorkflow,
  shouldFallbackToLocalUsers,
  syncAttendanceOutbox,
  upsertEmployeeUser,
}

export function createUsersWorkflowService(
  dependencies: UsersWorkflowDependencies = defaultDependencies
) {
  return {
    async saveUser(user: EmployeeUser) {
      await runBackendFirstWrite({
        backend: () => dependencies.saveUserWorkflow(user),
        fallback: async () => {
          await dependencies.upsertEmployeeUser(user)
          return user
        },
        onBackendSuccess: async (savedUser) => {
          await dependencies.cacheEmployeeUser(savedUser)
          await dependencies.notifyLocalDataChanged()
        },
        onLocalSuccess: () => runLocalWriteEffects(dependencies),
        shouldFallback: dependencies.shouldFallbackToLocalUsers,
      })
    },

    async deactivateUser(input: DeactivateUserInput) {
      return runBackendFirstWrite({
        backend: () => dependencies.deactivateUserWorkflow(input),
        fallback: () => dependencies.deactivateEmployeeUser(input),
        onBackendSuccess: async (user) => {
          await dependencies.cacheEmployeeUser(user)
          await dependencies.notifyLocalDataChanged()
        },
        onLocalSuccess: () => runLocalWriteEffects(dependencies),
        shouldFallback: dependencies.shouldFallbackToLocalUsers,
      })
    },

    async reactivateUser(user: EmployeeUser) {
      return runBackendFirstWrite({
        backend: () => dependencies.reactivateUserWorkflow(user),
        fallback: () => dependencies.reactivateEmployeeUser(user),
        onBackendSuccess: async (nextUser) => {
          await dependencies.cacheEmployeeUser(nextUser)
          await dependencies.notifyLocalDataChanged()
        },
        onLocalSuccess: () => runLocalWriteEffects(dependencies),
        shouldFallback: dependencies.shouldFallbackToLocalUsers,
      })
    },

    async inviteUser(input: InviteUserInput) {
      return runBackendFirstWrite({
        backend: () => dependencies.inviteUserWorkflow(input),
        fallback: () => dependencies.inviteEmployeeUser(input),
        onBackendSuccess: async (user) => {
          await dependencies.cacheEmployeeUser(user)
          await dependencies.notifyLocalDataChanged()
        },
        onLocalSuccess: () => runLocalWriteEffects(dependencies),
        shouldFallback: dependencies.shouldFallbackToLocalUsers,
      })
    },
  }
}

export const usersWorkflow = createUsersWorkflowService()
