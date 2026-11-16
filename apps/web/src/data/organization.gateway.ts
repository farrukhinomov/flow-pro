import {
  listOrganizationCatalogWorkflow,
  shouldFallbackToLocalOrganization,
} from './api/organization.api'
import {
  cacheManagerDelegations,
  listManagerDelegations,
} from './local/delegations.repo'
import {
  cacheOrganizationRecord,
  listOrganizationCatalog,
} from './local/organization.repo'

export async function listOrganizationWorkspaceBackendFirst() {
  try {
    const workspace = await listOrganizationCatalogWorkflow()
    await Promise.all([
      ...workspace.records.map((record) => cacheOrganizationRecord(record)),
      ...Array.from(
        new Set(workspace.delegations.map((delegation) => delegation.managerId))
      ).map((managerId) =>
        cacheManagerDelegations(
          managerId,
          workspace.delegations.filter(
            (delegation) => delegation.managerId === managerId
          )
        )
      ),
    ])
    return workspace
  } catch (error) {
    if (!shouldFallbackToLocalOrganization(error)) throw error
  }

  const [records, delegations] = await Promise.all([
    listOrganizationCatalog(),
    listManagerDelegations(),
  ])

  return { delegations, records }
}
