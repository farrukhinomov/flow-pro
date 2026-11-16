# Shared API And DTO Contracts

This document explains how the frontend models backend DTOs and how to change
contracts without breaking sync, authorization-sensitive workflows, or local
cache fallback.

## Source Files

Frontend:

- `apps/web/src/contracts/api.ts`: shared DTO types and zod schemas.
- `apps/web/src/contracts/generated/openapi.d.ts`: generated OpenAPI route
  and operation unions.
- `apps/web/src/contracts/api.test.ts`: parser/contract tests.
- `apps/web/src/data/api/*.api.ts`: focused HTTP clients and DTO mappers.
- `apps/web/src/data/api/http-client.ts`: shared axios instance and error
  normalization.
- `apps/web/src/domain/sync/protocol.ts`: sync protocol types.

Backend:

- `apps/api/src/FlowPro.Api/*`: endpoint binding.
- `apps/api/src/FlowPro.Application/*/*Contracts.cs`: command/query DTOs.
- `apps/api/src/FlowPro.Application/*/*Handler.cs`: contract behavior.

## Contract Principles

1. DTOs are explicit.
2. External payloads are parsed or mapped at the boundary.
3. UI components should not consume raw backend wire shapes when a domain or
   view-model shape exists.
4. Additive fields are allowed when consumers tolerate missing values.
5. Breaking changes require backend contract updates, frontend mapper updates,
   tests, and a sync/local-schema review.
6. Frontend code should branch on stable error `code` or `status`, not English
   message text.

## Important DTO Families

| Family | Frontend Area | Backend Area |
| --- | --- | --- |
| Auth session | `auth.api.ts`, `ApiAuthSessionDto` | `Authentication`, `Identity` |
| Attendance bookings/status | `attendance.api.ts` | `Attendance` |
| Request workflows | `request-workflows.api.ts` | `Requests` |
| Users | `users.api.ts` | `Users`, `Identity`, `Organization` |
| Organization catalogs | `organization.api.ts` | `Organization` |
| Employment contracts | `employment-contracts.api.ts` | `Organization` |
| Attendance policies | `attendance-policy.api.ts` | `Policies` |
| Timesheets | `timesheet.api.ts` | `Timesheets` |
| Planning packages | `planning.api.ts` | `Planning` |
| Report packages | `reports.api.ts` | `Reports` |
| Payroll export artifacts | `payroll-export-artifacts.api.ts` | `Payroll` |
| Notifications/preferences | `notifications.api.ts` | `Notifications` |
| Workspace claim/onboarding | `onboarding.api.ts` | `Onboarding` |
| Attachments/module aggregates | `module-aggregates.api.ts` | `Modules`, `Attachments` |
| Sync batches/feed | `sync.api.ts`, `domain/sync/protocol.ts` | `Sync` |

## HTTP Client Rules

`apps/web/src/data/api/http-client.ts` owns:

- base URL configuration
- bearer token injection
- development header auth injection
- timeout configuration
- problem-details parsing
- `FlowProApiError`

Feature code should not create ad hoc axios/fetch clients for FlowPro API
calls. Add a focused API module under `apps/web/src/data/api` instead.

## Generated REST Contract Layer

FlowPro keeps REST/minimal APIs for now. Legal write commands should stay as
explicit backend command endpoints rather than moving to generic GraphQL
mutations.

Generate the frontend OpenAPI contract from a running Development API:

```sh
cd apps/web
FLOWPRO_OPENAPI_URL=http://127.0.0.1:5123/openapi/v1.json \
npm run generate:api-contracts
```

The generated file intentionally starts small: endpoint paths, HTTP methods,
operation IDs, and tags. Use it as the typed inventory for API modules and grow
it before adding a second API surface.

## DTO Mapping Rules

API modules map backend DTOs to frontend domain shapes. Keep these mappers near
transport code so domain code does not need to know wire casing or backend enum
naming.

Examples:

- attendance maps backend `clockIn` to frontend `clock-in`
- attendance maps backend `homeOffice` to frontend `home-office`
- timesheets map nullable backend fields to optional frontend fields
- user APIs map ISO date strings to `Date` values for frontend user records

Do not pass backend DTOs directly into large UI components unless the DTO is
already the intentional UI model.

## Backend-First With Local Fallback

Some modules call backend workflows first and fall back to local cache when the
API is unavailable or the operation is explicitly offline-safe.

When adding fallback:

1. Add a clearly named `shouldFallbackToLocal*` helper.
2. Fallback only for network/unavailable/server failure cases unless product
   behavior explicitly allows more.
3. Do not silently fallback for authorization, validation, or conflict errors.
4. Cache successful backend results in the matching local repository.
5. Notify local data/sync listeners after writes.

Legal records such as attendance writes should not silently become local-only
records when the backend command fails.

## Sync Protocol Versioning

Current protocol:

```text
flowpro-sync-v1
```

Frontend local schema version is declared in:

```text
apps/web/src/data/local/db.ts
```

When sync payload semantics change:

1. Update `ApiSyncOperationDto` and related DTOs.
2. Update `apps/web/src/domain/sync/protocol.ts`.
3. Update backend sync contracts and validation.
4. Decide whether `LOCAL_DB_SCHEMA_VERSION` must increase.
5. Add migration notes for user-visible local data changes.
6. Update [Frontend sync engine](frontend/sync-engine.md) and
   [Backend sync](backend/sync.md).
7. Run frontend and backend tests plus integrated e2e.

## Onboarding Contracts

Onboarding has one property no other family has: two of its endpoints are called
before the caller belongs to a tenant, so they answer for a principal rather than
a request identity. See [Backend onboarding](backend/onboarding.md).

| Endpoint | Frontend DTO |
| --- | --- |
| `GET /onboarding/workspace` | `ApiWorkspaceClaimStateDto` |
| `POST /onboarding/workspace` | `ApiWorkspaceClaimResultDto` |
| `GET /onboarding/state` | `ApiOnboardingStateDto` |
| `PUT /onboarding/steps/company` | `ApiCompanyProfileDto` |
| `POST /onboarding/steps/{step}/resolve` | `ApiOnboardingStateDto` |
| `POST /onboarding/complete` | `ApiOnboardingStateDto` |

Step keys travel as kebab-case strings (`company`, `team`, `absences`,
`first-clock-in`) and are modelled as `ApiOnboardingStepKey`. The backend enum
is mapped in `OnboardingDefaults.ToWireFormat`; do not serialize the C# enum
name directly.

`/auth/session` answering 401 is part of this contract. It distinguishes "token
is valid but this account has no workspace" from a real authorization failure,
and the client branches on it through `isUnclaimedWorkspaceError()`. Do not
change that status without updating the callback route.

## API Change Checklist

1. Update backend command/query or endpoint contract.
2. Update frontend DTO type and mapper in `apps/web/src/data/api`.
3. Regenerate OpenAPI contracts when endpoint paths or operations change.
4. Add or update zod runtime schema in `apps/web/src/contracts/api.ts` when
   external input is parsed.
5. Update domain/view-model tests affected by the shape.
6. Review local cache and sync schema implications.
7. Update this doc when the change affects auth, sync, identifiers, timestamps,
   permissions, errors, or fallback behavior.
8. Run:

```sh
cd apps/web
npm run check
npm run test:e2e
```

```sh
cd apps/api
dotnet test FlowPro.slnx
```
