import type {
  DepartmentCatalog,
  LocationCatalog,
  RoleProfile,
  TeamCatalog,
  WorkPatternCatalog,
} from '@/domain/organization/types'

/**
 * Which catalog the editor drawer is open for, and the record it is editing.
 *
 * This is the contract between the catalog tables and the drawer, so it lives
 * apart from both. `undefined` record means "create"; `null` state means the
 * drawer is closed.
 */
export type OrganizationDrawerState =
  | { kind: 'department'; record?: DepartmentCatalog }
  | { kind: 'location'; record?: LocationCatalog }
  | { kind: 'role'; record?: RoleProfile }
  | { kind: 'team'; record?: TeamCatalog }
  | { kind: 'work-pattern'; record?: WorkPatternCatalog }
  | null

/** Slug used when a catalog record is saved without an explicit code. */
export function toCatalogSlug(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
