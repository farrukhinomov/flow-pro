import { installDemoOrganization } from './organization.install'
import { installDemoPeople } from './people.install'
import { installDemoRequests } from './requests.install'

export { seedUserCredentials, seedUsers } from './people'

/**
 * Populates the local database with the demo workspace.
 *
 * Called once from the app bootstrap, behind {@link isDemoDataEnabled}, and
 * only ever through a dynamic import. That is what keeps every fixture out of
 * a production bundle: Vite splits the dynamic import into its own chunk, and
 * nothing in a real build references it.
 *
 * Previously each repository seeded itself lazily from inside an ordinary read,
 * which is how invented colleagues reached real tenants — `listEmployeeUsers()`
 * wrote fixtures as a side effect of being called. Repositories now only read
 * and write what they are given.
 *
 * Order matters: organization catalogs are derived from the directory, so
 * people are installed first.
 */
export async function installDemoData() {
  await installDemoPeople()
  await installDemoOrganization()
  await installDemoRequests()
}
