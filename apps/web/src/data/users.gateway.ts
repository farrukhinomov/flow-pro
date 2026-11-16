import { listUsersWorkflow, shouldFallbackToLocalUsers } from './api/users.api'
import { cacheEmployeeUser, listEmployeeUsers } from './local/users.repo'

export async function listEmployeeUsersBackendFirst() {
  try {
    const users = await listUsersWorkflow()
    await Promise.all(users.map((user) => cacheEmployeeUser(user)))
    return users
  } catch (error) {
    if (!shouldFallbackToLocalUsers(error)) throw error
  }

  return listEmployeeUsers()
}
