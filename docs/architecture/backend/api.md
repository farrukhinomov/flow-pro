# Backend API Guide

FlowPro API endpoints are thin HTTP adapters over application commands and
queries. The API layer should authenticate, bind input, call one handler, and
return a stable contract. Business decisions belong in `FlowPro.Application` or
`FlowPro.Domain`.

## Runtime Entry

The API composition root is:

```text
apps/api/src/FlowPro.Api/Program.cs
```

`Program.cs` configures:

- JSON logging
- problem details and global exception handling
- OpenAPI and Scalar in Development
- data protection
- current request context
- application and infrastructure services
- authentication, authorization, CORS, and rate limiting
- health checks
- endpoint groups
- optional migration and development seeding

## Endpoint Source Map

| Area | Endpoint File | Route Prefix |
| --- | --- | --- |
| Auth/session | `Authentication/AuthEndpoints.cs` | `/api/v1/auth` |
| Attendance | `Attendance/AttendanceEndpoints.cs` | `/api/v1/attendance` |
| User preferences | `Identity/UserPreferencesEndpoints.cs` | `/api/v1/me/preferences` |
| Attachments | `Modules/AttachmentFileEndpoints.cs` | `/api/v1/attachments/files` |
| Module aggregates | `Modules/ModuleAggregateEndpoints.cs` | multiple `/api/v1/*` aggregate routes |
| Attendance policies | `Policies/AttendancePolicyWorkflowEndpoints.cs` | `/api/v1/attendance-policy-workflows` |
| Notifications | `Notifications/NotificationWorkflowEndpoints.cs` | `/api/v1/notification-center` |
| Onboarding | `Onboarding/OnboardingEndpoints.cs` | `/api/v1/onboarding` |
| Operations health | `Operations/OperationsHealthEndpoints.cs` | `/api/v1/operations` |
| Organization catalogs | `Organization/OrganizationCatalogEndpoints.cs` | `/api/v1/directory/organization-catalogs` |
| Employment contracts | `Organization/EmploymentContractWorkflowEndpoints.cs` | `/api/v1/directory/employment-contracts` |
| Payroll artifacts | `Payroll/PayrollExportArtifactEndpoints.cs` | `/api/v1/payroll-export-artifacts` |
| Planning | `Planning/PlanningWorkflowEndpoints.cs` | `/api/v1/planning-workflows` |
| Reports | `Reports/ReportWorkflowEndpoints.cs` | `/api/v1/report-workflows` |
| Requests | `Requests/RequestWorkflowEndpoints.cs` | `/api/v1/request-workflows` |
| Sync | `Sync/SyncEndpoints.cs` | `/api/v1/sync` |
| Timesheets | `Timesheets/TimesheetWorkflowEndpoints.cs` | `/api/v1/timesheet-workflows` |
| Users | `Users/UserWorkflowEndpoints.cs` | `/api/v1/directory/users` |
| Development | `Development/DevelopmentEndpoints.cs` | `/api/v1/development` |

## Endpoint Pattern

Use this shape for new endpoints:

1. Map the route in a focused `*Endpoints.cs` file.
2. Bind simple route/query/body values.
3. Require the narrowest authorization policy.
4. Call one command/query handler.
5. Return the application contract directly unless an HTTP-specific result is
   required.
6. Let `GlobalExceptionHandler` translate known application exceptions.

Avoid controller-sized endpoint files. If an endpoint needs branching, move the
branching to an application handler.

## Authorization Pattern

Use:

```csharp
.RequireAuthorization(PermissionKeys.SomePermission)
```

Use plain `.RequireAuthorization()` only when any authenticated user is allowed
and ownership checks happen in the handler.

Do not use a broad permission to make a UI flow pass. Add or choose the narrowest
permission for the action.

## Error Contract

Backend errors should be problem details with stable machine-readable codes.
Frontend code maps those errors to `FlowProApiError`.

Expected application exceptions:

- `FlowProUnauthorizedException`: no valid authenticated identity.
- `FlowProForbiddenException`: identity lacks permission.
- `FlowProNotFoundException`: requested tenant-scoped resource was not found.
- `FlowProValidationException`: invalid input or unsupported protocol.
- `FlowProConflictException`: idempotency or state conflict.

Frontend code should branch on `code` or `status`, not English message text.

## Important Workflow Endpoints

Attendance:

- `GET /api/v1/attendance/me/status`
- `GET /api/v1/attendance/me/events`
- `POST /api/v1/attendance/commands/clock-in`
- `POST /api/v1/attendance/commands/start-break`
- `POST /api/v1/attendance/commands/resume-work`
- `POST /api/v1/attendance/commands/clock-out`
- `POST /api/v1/attendance/commands/manual-booking`
- `POST /api/v1/attendance/bookings/{bookingId}/corrections`
- `POST /api/v1/attendance/bookings/{bookingId}/void`

Timesheets:

- `GET /api/v1/timesheet-workflows/{employeeId}/{periodMonth}`
- `POST /api/v1/timesheet-workflows/{employeeId}/{periodMonth}/sign`
- `POST /api/v1/timesheet-workflows/{employeeId}/{periodMonth}/reopen`
- `POST /api/v1/timesheet-workflows/{employeeId}/{periodMonth}/exports/{kind}`

Users:

- `GET /api/v1/directory/users`
- `PUT /api/v1/directory/users/{userId}`
- `POST /api/v1/directory/users/invitations`
- `POST /api/v1/directory/users/{userId}/deactivate`
- `POST /api/v1/directory/users/{userId}/reactivate`

Attendance policies:

- `GET /api/v1/attendance-policy-workflows/{policyId}?at=<iso>`
- `GET /api/v1/attendance-policy-workflows/{policyId}/history`
- `PUT /api/v1/attendance-policy-workflows/{policyId}?effectiveFrom=<iso>`

`at` resolves the revision governing that instant, which is how an audit of a
historic period asks "which rules applied". Omitted, it resolves to now.
`effectiveFrom` schedules a revision without disturbing the one governing today.
Reading history requires `attendance-policy.manage`: it is an audit action.

User preferences:

- `GET /api/v1/me/preferences`
- `PUT /api/v1/me/preferences`

Both resolve the owner from the authenticated identity and never accept a user
id, so they need no permission beyond authentication.

Sync:

- `GET /api/v1/sync/changes?after=<sequence>&limit=<count>`
- `POST /api/v1/sync/batches`

Operations:

- `GET /api/v1/operations/health`

Operations health is a read-only operator contract behind
`PermissionKeys.AuditViewFull`. It reports backend source-of-truth signals used
by the Quality Health dashboard:

- generated timestamp
- pending and failed backend outbox counts
- oldest pending outbox timestamp
- last processed outbox timestamp
- last backend outbox error
- audit event count and latest audit event timestamp
- client projection count and latest projection update timestamp
- normalized status: `ok`, `warning`, or `critical`

Keep this endpoint narrow. Do not return raw payload JSON, internal stack
traces, tenant data from other tenants, or worker implementation details.

## Cursor Pagination And Filtering

New list endpoints should use cursor pagination instead of offset pagination.
Shared primitives live in:

```text
apps/api/src/FlowPro.Application/Common/CursorPagination.cs
```

Default rules:

- default limit: 50
- max limit: 100
- return `items` and `nextCursor`
- use stable deterministic ordering
- encode cursors as opaque strings
- validate filter fields against an allowlist
- never let clients inject raw SQL field names

Apply this shape first to users, audit, planning, reports, notifications, and
sync feed refinements as those endpoints are touched.

## Idempotency

Attendance write endpoints require `Idempotency-Key`. The application layer
serializes commands by tenant, employee, and idempotency key inside one
transaction.

New legal or payment-like commands should define idempotency behavior before the
endpoint is exposed.

## Development API

Development endpoints are registered only in ASP.NET Development. They may use
development header auth and must never be enabled in production.

Current helper:

- `POST /api/v1/development/reset-attendance`

This endpoint exists to make integrated browser tests deterministic.

## API Change Checklist

1. Add or change an application command/query contract.
2. Update endpoint binding.
3. Add authorization policy requirements.
4. Add or update application tests.
5. Update frontend DTOs and mappers in `apps/web/src/data/api`.
6. Update shared schemas in `apps/web/src/contracts/api.ts` when applicable.
7. Update [Shared API contracts](../api-contracts.md).
8. Run backend and relevant frontend checks.
