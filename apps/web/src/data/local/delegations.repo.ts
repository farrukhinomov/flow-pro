import {
  makeManagerDelegationId,
  type ManagerDelegation,
} from '@/domain/users/delegations'
import { appendAuditEvent } from './audit.repo'
import { deleteFromStore, getAllFromStore, putInStore } from './db'

export async function listManagerDelegations() {
  return getAllFromStore<ManagerDelegation>('managerDelegations')
}

export async function setManagerDelegations({
  managerId,
  teams,
}: {
  managerId: string
  teams: string[]
}) {
  const current = await listManagerDelegations()
  const nextTeams = new Set(teams.filter(Boolean))
  const managerCurrent = current.filter((item) => item.managerId === managerId)
  const now = new Date().toISOString()

  const toDelete = managerCurrent.filter((item) => !nextTeams.has(item.team))
  const toUpsert = Array.from(nextTeams).map<ManagerDelegation>((team) => ({
    id: makeManagerDelegationId(managerId, team),
    managerId,
    team,
    active: true,
    createdAt:
      managerCurrent.find((item) => item.team === team)?.createdAt ?? now,
    updatedAt: now,
  }))

  await Promise.all([
    ...toDelete.map((item) => deleteFromStore('managerDelegations', item.id)),
    ...toUpsert.map((item) => putInStore('managerDelegations', item)),
  ])

  await appendAuditEvent({
    id: `audit-user-delegation-${managerId}-${Date.now()}`,
    aggregate: 'user',
    aggregateId: managerId,
    action: 'user.delegations.updated',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: 'operational',
    createdAt: now,
    metadata: { teams: Array.from(nextTeams) },
    summary: `Delegated teams updated for manager ${managerId}.`,
  })
}

export async function cacheManagerDelegations(
  managerId: string,
  delegations: ManagerDelegation[]
) {
  const current = await listManagerDelegations()
  const managerCurrent = current.filter((item) => item.managerId === managerId)

  await Promise.all([
    ...managerCurrent.map((item) =>
      deleteFromStore('managerDelegations', item.id)
    ),
    ...delegations.map((item) => putInStore('managerDelegations', item)),
  ])
}
