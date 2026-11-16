# Feature Development Guide

Use this guide when adding or changing a FlowPro feature. It is written for a
junior developer who knows TypeScript or C# basics but is still learning this
codebase.

## First Decision

Before coding, decide what kind of change this is:

| Change | Start Here |
| --- | --- |
| UI-only display or filtering | frontend `features` and maybe `domain` |
| Frontend write flow | frontend `application`, `data/api`, `data/local` |
| Backend read query | backend `Application` query plus API endpoint |
| Backend write command | backend `Domain`, `Application`, `Infrastructure`, API |
| DTO or payload change | backend contracts plus frontend API mappers |
| Sync/local cache change | frontend `data/sync`, `data/local`, backend sync/outbox |

If the action affects legal records, money, identity, permissions, policies, or
auditable workflow state, it should end behind a backend command.

## Frontend Change Pattern

Use this path for frontend work:

```text
routes -> features -> application -> data -> domain
routes -> features -> domain
```

Do not import upward:

```text
domain -> data/features/routes/components
data -> routes/components
application -> routes/features/components
features -> routes
```

### Add A Page

1. Add a route under `apps/web/src/routes/_authenticated`.
2. Add navigation in `apps/web/src/components/layout/data/sidebar-data.ts`.
3. Put the main page component in `apps/web/src/features/<area>`.
4. Put reusable display parts in `features/<area>/components`.
5. Put derived rows, filters, totals, and formatting in a view model.
6. Add a view-model or domain test if behavior is non-trivial.

Route files should stay small. They should compose the page, not own tables,
drawers, or business rules.

### Add A Frontend Write Workflow

1. Define or reuse domain command/policy functions in `apps/web/src/domain`.
2. Add a workflow service in `apps/web/src/application/<area>-workflow.ts`.
3. Call backend-first APIs from `apps/web/src/data/api`.
4. Fall back to local IndexedDB only when the operation is offline-safe.
5. Cache backend results in `apps/web/src/data/local` when needed.
6. Notify sync/local data listeners after successful writes.
7. Add application smoke tests for multi-step workflows.

Examples:

- `apps/web/src/application/backend-first-workflow.ts`
- `apps/web/src/application/attendance-workflow.ts`
- `apps/web/src/application/request-workflow.ts`
- `apps/web/src/application/timesheet-workflow.ts`
- `apps/web/src/application/users-workflow.ts`

## Backend Change Pattern

Backend modules are vertical slices through the modular monolith.

For a new backend workflow:

1. Add or update domain entities/invariants in `FlowPro.Domain`.
2. Add command/query contracts in `FlowPro.Application/<Area>`.
3. Add one focused handler in `FlowPro.Application/<Area>`.
4. Add repository/port interfaces only when persistence or integration is
   needed.
5. Implement repositories in `FlowPro.Infrastructure/<Area>`.
6. Register handlers and repositories in dependency injection.
7. Add endpoints in `FlowPro.Api/<Area>/<Area>Endpoints.cs`.
8. Require the narrowest permission policy.
9. Add audit and outbox records inside the same transaction for writes.
10. Add domain/application tests.
11. Update docs and frontend contracts.

Good examples:

- `Timesheets`
- `Users`
- `Notifications`
- `Organization`
- `Payroll`

## Backend Endpoint Checklist

Every endpoint should:

- live in a focused `*Endpoints.cs` file
- bind route/query/body values
- call one command/query handler
- require authorization
- avoid business logic
- return stable contracts
- rely on `GlobalExceptionHandler` for known application exceptions

## Contract Checklist

When a backend response changes:

1. Update the backend application record.
2. Update endpoint tests or application tests.
3. Update frontend API module types and mappers.
4. Update `apps/web/src/contracts/api.ts` if the shared contract changed.
5. Update [Shared API contracts](../architecture/api-contracts.md).
6. Consider whether local sync schema or IndexedDB schema must change.

## Testing Strategy

Choose the cheapest test that proves the behavior:

- Domain test: pure rule, calculation, state transition.
- Application test: workflow orchestration, permissions, transaction side
  effects.
- View-model test: frontend derived rows, filters, summaries, exports.
- E2E test: authentication, real backend, browser behavior, responsive flow.

Do not use e2e as the first test for a pure calculation.

## Done Criteria

A feature is maintainable when:

- code is in the correct layer
- route files stay thin
- backend writes are transactional
- server authorization is enforced
- DTOs are mapped at boundaries
- local fallback is intentional and documented
- tests cover the changed behavior
- docs describe the new workflow
- `npm run check` or backend `bash scripts/check.sh` passes for relevant areas
