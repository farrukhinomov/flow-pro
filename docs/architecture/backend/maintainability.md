# Backend Maintainability Guide

This guide explains how to keep the backend understandable without AI help.

## Design Priorities

1. Correctness and auditability over framework cleverness.
2. Explicit command/query handlers over hidden dispatch.
3. Strong PostgreSQL transactions for legal records.
4. Small vertical modules inside the modular monolith.
5. Documentation updated in the same change as implementation.

## Layer Responsibilities

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| `FlowPro.Api` | HTTP binding, auth policies, composition root, health, OpenAPI | Business invariants, persistence SQL |
| `FlowPro.Application` | Use cases, commands, queries, ports, transactions | EF configuration, HTTP concerns |
| `FlowPro.Domain` | Entities, value objects, invariants, domain errors | DI, EF, HTTP, logging |
| `FlowPro.Infrastructure` | EF Core, PostgreSQL repositories, locks, audit/outbox persistence | UI contracts, endpoint routing |
| `FlowPro.Worker` | background outbox dispatch and scheduled work | request/response API behavior |

## Adding A Use Case

1. Put invariant-heavy behavior in `FlowPro.Domain`.
2. Create an explicit command/query contract in `FlowPro.Application`.
3. Implement one dedicated handler.
4. Use `IUnitOfWork` for transactional writes.
5. Add repository or port interfaces only when the handler needs persistence or
   external integration.
6. Implement ports in `FlowPro.Infrastructure`.
7. Expose the use case through one focused API endpoint.
8. Add tests at the domain or application layer first.
9. Update docs if the use case affects API, auth, sync, storage, or operations.

## Transaction Rules

Use one transaction for each command that changes legal or user-visible state.
Attendance commands must keep these writes together:

- booking/state mutation
- audit event
- outbox message

Do not write audit or outbox records after the transaction commits. If the
business change commits, its evidence and integration message must commit too.

## Authorization Rules

- Endpoints require policies.
- Handlers may perform additional ownership checks.
- Permission checks query database state.
- Development header auth is never production auth.
- Client roles are never trusted as API authorization.

## Persistence Rules

- Every tenant-owned query includes tenant id.
- Prefer explicit repository methods over generic repository abstractions.
- Use migrations for schema changes.
- Run pending model change checks before release.
- Do not physically delete legal attendance evidence.
- Use soft-delete or immutable replacement patterns for auditable records.

## Testing Strategy

Use the cheapest reliable test:

- Domain tests for entity invariants and pure rules.
- Application tests for command/query orchestration.
- Architecture tests for dependency direction.
- Integrated browser tests from the client for end-to-end API/UI behavior.

Release command:

```sh
bash scripts/check.sh
```

Focused test command:

```sh
dotnet test FlowPro.slnx
```

## Documentation Ownership

Update these files when behavior changes:

- API shape or endpoint behavior: `docs/architecture/backend/api.md`
- Authentication or permissions: `docs/architecture/backend/auth.md`
- Sync protocol, aggregate permissions, or conflict rules: `docs/architecture/backend/sync.md`
- Deployment/backup/storage behavior: `docs/self-hosting/*`
- Architectural direction: `docs/architecture/backend/architecture.md`

## Review Checklist

1. Does the change preserve layer direction?
2. Does every write have a clear transaction boundary?
3. Are audit and outbox writes committed with the business change?
4. Is authorization enforced server-side?
5. Are tenant ids present in repository queries?
6. Are errors machine-readable?
7. Are docs and tests updated?
