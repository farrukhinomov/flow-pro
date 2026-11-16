import { isLocalCredentialAuthEnabled } from '@/data/auth/auth-mode'

/**
 * Whether this build may write fictional people into the local database.
 *
 * The seeded directory, requests, and organization catalogs exist so the local
 * development experience has something to show. They were previously written
 * whenever a store was empty, with no environment check, which meant a real
 * tenant met them too:
 *
 * - `applicationStore` emits the local snapshot before the remote one, so
 *   invented colleagues appeared in the directory ahead of the real list.
 * - With the API unreachable they persisted rather than flashing.
 * - A brand-new workspace with one founder got an organization chart derived
 *   entirely from invented people.
 * - Worst of it: seeded requests synthesise matching audit events, which were
 *   then hash-sealed with the same chain used for real evidence. The audit
 *   screen showed invented entries and reported the chain valid.
 *
 * Gated on the local-credential signal rather than `import.meta.env.DEV`
 * because that is the flag that already means "this is the demo experience".
 * A development build pointed at a real backend gets real data and nothing
 * else, which `DEV` alone would not give.
 *
 * Product defaults are deliberately not covered by this. Attendance types and
 * the default attendance policy are what an offline workspace needs to
 * function, not fiction, so they still seed everywhere.
 */
export function isDemoDataEnabled() {
  return isLocalCredentialAuthEnabled()
}
