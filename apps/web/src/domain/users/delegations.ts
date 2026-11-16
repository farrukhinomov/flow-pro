export type ManagerDelegation = {
  id: string
  managerId: string
  team: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export function makeManagerDelegationId(managerId: string, team: string) {
  return `delegation-${managerId}-${team.toLowerCase().replace(/\s+/g, '-')}`
}
