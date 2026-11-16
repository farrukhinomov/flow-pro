# Why FlowPro uses lightweight CQRS

## Decision

FlowPro application use cases will be represented by explicit command/query
contracts and dedicated handlers. Commands and queries share the same
PostgreSQL database and are registered directly with dependency injection.

FlowPro will not add a mediator package, event sourcing, or a separate read
database until measured complexity, scale, or ownership boundaries justify it.

## Rationale

CQRS makes write invariants, transactions, permissions, auditing, and read
projections easier to locate and test. Keeping dispatch and persistence simple
preserves strong consistency, low self-hosting cost, and straightforward
debugging while avoiding an unnecessary framework dependency.
