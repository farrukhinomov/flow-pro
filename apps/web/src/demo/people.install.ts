import {
  deleteFromStore,
  getAllFromStore,
  putManyInStore,
} from '@/data/local/db'
import type { EmployeeUser } from '@/domain/users/types'
import { seedUsers } from './people'

/**
 * Demo identities that shipped under an older address and would otherwise
 * linger in a browser that has run FlowPro before.
 *
 * Only ever matched together with the retired `@flowpro.dev` domain, so a real
 * record that happens to share an id is never deleted.
 */
const OBSOLETE_DEMO_USER_IDS = new Set([
  'usr-anna-koenig',
  'usr-jonas-weber',
  'usr-lena-brandt',
  'usr-marco-halder',
  'usr-nina-brandt',
  'usr-sven-koch',
])

const FOUNDER_ID = 'usr-marta-lindgren'

/**
 * Reconciles the demo directory in an already-seeded browser.
 *
 * The store persists across reloads, so a browser that ran an older build keeps
 * its copy of the fixtures. This drops identities that were retired, adds ones
 * that were introduced since, and re-baselines the founder record whose fields
 * the demo relies on for sign-in.
 */
export async function installDemoPeople() {
  const current = await getAllFromStore<EmployeeUser>('employeeUsers')

  if (current.length === 0) {
    await putManyInStore('employeeUsers', seedUsers)
    return
  }

  const obsolete = current.filter(
    (user) =>
      OBSOLETE_DEMO_USER_IDS.has(user.id) && user.email.endsWith('@flowpro.dev')
  )

  await Promise.all(
    obsolete.map((user) => deleteFromStore('employeeUsers', user.id))
  )

  const retained = current.filter((user) => !obsolete.includes(user))
  const byId = new Map(retained.map((user) => [user.id, user]))
  const missing = seedUsers.filter((user) => !byId.has(user.id))
  const founderSeed = seedUsers.find((user) => user.id === FOUNDER_ID)
  const currentFounder = byId.get(FOUNDER_ID)
  const founderBaseline =
    currentFounder && founderSeed
      ? {
          ...currentFounder,
          email: founderSeed.email,
          firstName: founderSeed.firstName,
          lastName: founderSeed.lastName,
          manager: founderSeed.manager,
          role: founderSeed.role,
          status: 'active' as const,
          team: founderSeed.team,
          updatedAt: new Date(),
          username: founderSeed.username,
          visibilityScope: founderSeed.visibilityScope,
          workPattern: founderSeed.workPattern,
        }
      : undefined
  const founderDrifted =
    currentFounder &&
    founderBaseline &&
    (currentFounder.email !== founderBaseline.email ||
      currentFounder.firstName !== founderBaseline.firstName ||
      currentFounder.lastName !== founderBaseline.lastName ||
      currentFounder.role !== founderBaseline.role ||
      currentFounder.status !== founderBaseline.status ||
      currentFounder.team !== founderBaseline.team ||
      currentFounder.username !== founderBaseline.username)
  const updates = [
    ...missing,
    ...(founderDrifted && founderBaseline ? [founderBaseline] : []),
  ]

  if (updates.length > 0) await putManyInStore('employeeUsers', updates)
}
