# Frontend Architecture

FlowPro frontend code is organized so maintainers can find behavior by business
area and change it with local tests. React components should render decisions
that have already been made by domain, application, or view-model code.

## Stack

- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- TanStack Table
- shadcn/Radix UI
- Tailwind CSS
- axios
- zod
- Zustand
- IndexedDB
- Playwright

## Source Map

```text
apps/web/src
├── routes/          # route entries, search params, layout composition
├── features/        # feature UI, hooks, view models, page components
├── application/     # write workflows and side-effect orchestration
├── domain/          # business rules, policies, pure calculations
├── data/api/        # HTTP transport and DTO mapping
├── data/local/      # IndexedDB repositories and local cache/outbox writes
├── data/sync/       # pull/apply sync loop and outbox submission
├── contracts/       # shared DTO/runtime schemas
├── components/      # shared UI primitives and reusable FlowPro UI
├── context/         # app providers
├── hooks/           # generic reusable hooks
├── i18n/            # messages and formatting helpers
├── lib/             # utilities
└── stores/          # small app stores such as auth
```

## Layer Responsibilities

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| `routes` | route entry points, search params, page composition, redirects | business rules, persistence details, large tables/drawers |
| `features` | feature UI, hooks, view models, page-specific components | backend transport primitives, cross-feature write orchestration |
| `application` | write workflows, backend-first/local-fallback orchestration | React state, JSX, route decisions |
| `domain` | business rules, policies, calculations, state transitions | React, IndexedDB, API clients |
| `data/api` | HTTP calls, DTO mapping, transport errors | UI decisions, domain validation rules |
| `data/local` | IndexedDB stores, local cache, outbox records | React rendering, route navigation |
| `data/sync` | sync pull/apply, outbox submission, conflict handling | feature-specific UI copy |
| `contracts` | shared DTOs and runtime schemas | UI convenience models |
| `components` | shared UI primitives and reusable FlowPro components | product workflow orchestration |

## Dependency Direction

Keep imports flowing toward stable logic:

```text
routes -> features -> application -> data -> domain
routes -> features -> domain
routes -> data -> domain
components -> domain
contracts -> domain types only when DTOs intentionally mirror domain values
```

Do not import upward:

```text
domain -> data/features/routes/components
data -> routes/components
application -> features/routes/components
features -> routes
```

When an import violates this direction, move the shared concept downward into
`domain`, `contracts`, or a focused `application` workflow.

## Route Rules

Routes should:

- parse route/search parameters
- guard access or redirect
- load top-level data when needed
- compose feature components

Routes should not:

- contain large tables or drawers
- directly manipulate IndexedDB
- directly branch on backend DTO details
- own business calculations

Split route files before they become hard to review. The maintenance threshold
is 900 lines.

## Feature Layout

Recommended layout:

```text
src/routes/_authenticated/<page>/index.tsx
src/application/<area>-workflow.ts
src/features/<area>/hooks/use-<area>.ts
src/features/<area>/<area>-view-model.ts
src/features/<area>/components.tsx
src/features/<area>/components/<specific-part>.tsx
src/features/<area>/<area>-view-model.test.ts
```

Keep pure formatting, filtering, totals, row construction, export preparation,
and status derivation in view models or domain functions so they are easy to
test without a browser.

## Write Workflow Pattern

User actions that change data should use an application workflow when they touch
more than one concern.

Typical flow:

1. UI collects input in `features/<area>`.
2. Feature hook or route calls `application/<area>-workflow.ts`.
3. Application workflow calls domain commands or policies.
4. Application workflow calls `data/api` for backend-first writes.
5. If the operation is offline-safe, it may fall back to `data/local`.
6. Application workflow updates cache and sync notifications.
7. UI refreshes through repository/API results or local-data subscriptions.

Examples:

- `attendance-workflow.ts`
- `request-workflow.ts`
- `timesheet-workflow.ts`
- `users-workflow.ts`
- `organization-workflow.ts`
- `attendance-policy-workflow.ts`

## Application Store Read Pattern

Read-heavy screens should use `src/application/application-store.ts`.

The store follows a read-through pattern:

1. Load a local IndexedDB snapshot.
2. Emit it immediately to the caller.
3. Refresh from the backend workflow/API.
4. Cache the remote result through existing gateways/repositories.
5. Emit the remote snapshot.
6. Fall back to the local snapshot only when the backend is unavailable and the
   screen can safely show cached data.

Use this for Today, Timesheet, Planning, Users, Reports, notifications, and
other operational dashboards. Do not use it to make legal writes local-only.

## Backend-First Versus Local-First

Use backend-first workflows for:

- attendance clocking, manual bookings, corrections, and voids
- request submit/cancel/decision/adjust-and-approve
- timesheet sign/reopen/export markers
- payroll export artifacts
- users and identity-affecting directory writes
- attendance policies
- organization catalogs and employment contracts as their typed workflows land
- notifications and preferences

Use local-first writes only when the action is explicitly offline-safe or still
transitional. Local-first writes must:

- update IndexedDB
- enqueue or apply sync where appropriate
- emit local-data notifications
- preserve audit/sync side effects where the module requires them
- be documented as fallback behavior

## API Client Rules

Use `src/data/api/http-client.ts` for FlowPro API calls. Do not create ad hoc
axios/fetch clients inside features.

API modules should:

- call one backend area
- type backend DTOs
- map wire enums/casing into frontend domain shapes
- convert transport failures to `FlowProApiError`
- expose `shouldFallbackToLocal*` helpers only when fallback is intentional

## IndexedDB Rules

`src/data/local/db.ts` owns the local schema version and object stores.

When changing stores:

1. Bump `LOCAL_DB_SCHEMA_VERSION`.
2. Add migration notes.
3. Update repository functions.
4. Update [Frontend sync engine](sync-engine.md).
5. Test export/import/reset if the change affects user data.

## Attendance Day Assignment

Attendance instants are stored as UTC, so which calendar day one belongs to is
an explicit decision rather than a property of the value.

`src/domain/attendance/calendar-day.ts` is the single definition. It is
anchored on the workspace time zone, resolved from the headquarters location by
`src/data/workspace-time-zone.gateway.ts` and read through
`useWorkspaceTimeZone`.

Anchoring matters as much as the rule. A working-time record has to describe
the same day to the employee who booked it, the manager who approves it, and
the payroll export. If day assignment followed each viewer's browser, an
employee in Berlin and a manager in London would disagree about which day a
late shift belongs to.

Rules for new code that groups attendance by day:

- Use `toCalendarDay` or `isSameCalendarDay`. Never slice an ISO string, which
  yields the UTC day, and never read local date parts directly.
- Pass the workspace zone. Omitting it falls back to the browser zone, which is
  correct only while the workspace zone is still loading.

## Testing Ownership

Use the cheapest reliable test:

- Domain tests for rules and state machines.
- Application smoke tests for complete write workflows.
- View-model tests for filters, formatting, derived rows, and exports.
- Integrated e2e for auth, real backend behavior, sync, and responsive flows.

Important commands:

```sh
cd apps/web
npm run maintenance
npm run check
npm run test:e2e
```

## Change Checklist

1. Identify whether behavior belongs to route, feature, application, data, or
   domain code.
2. Add or update the smallest useful test.
3. Keep backend DTO changes reflected in `src/contracts/api.ts` and
   [Shared API contracts](../api-contracts.md).
4. Keep local database changes in `src/data/local/db.ts` and update
   [Frontend sync engine](sync-engine.md).
5. Run relevant verification commands.
