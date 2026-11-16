# Why FlowPro is a modular monolith

## Decision

FlowPro will use a modular monolith with an independently deployable API and
worker from one solution and one PostgreSQL database.

## Rationale

The initial scale does not require microservices. Strong transactions,
auditability, low operational complexity, self-hosted deployment, and a small
engineering team are higher priorities. Module boundaries and the transactional
outbox preserve a path to extract a service later when independent scaling or
ownership provides measurable value.
