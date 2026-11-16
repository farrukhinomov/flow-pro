# Backend Workflow Migration Plan

FlowPro intentionally supports local-first client aggregates while modules are
being promoted to authoritative backend workflows. This document defines the
target state so new work does not add more business-critical behavior only in
IndexedDB.

## Rule

Legal, financial, identity, and policy-changing actions must end behind explicit
backend commands. Client aggregates may remain as cache, sync feed, offline
draft storage, or compatibility transport while a vertical slice is migrated.

## Current State

| Area | Current backend support | Target backend workflow |
| --- | --- | --- |
| Attendance clocking | Dedicated commands and normalized tables | Keep as source of truth |
| Request decisions | Dedicated workflow endpoints stored as synced request documents | Normalize request/approval tables when reporting needs require it |
| Payroll exports | Dedicated workflow endpoint plus retained export artifact workflow for CSV/HTML downloads, object storage metadata, audit/outbox events, and local UI fallback | Add renderer-backed PDF generation and long-term retention policies |
| Timesheet sign-off | Dedicated read/sign/reopen/export workflow with immutable monthly snapshots, RLS, audit/outbox events, and local cache fallback | Add server-generated PDF/payroll artifacts and manager-facing close-period controls |
| Users | Typed directory workflow for list, upsert, invite, deactivate, reactivate; local cache fallback remains | Add scoped directory reads plus SCIM/OIDC provisioning |
| Attendance policies | Versioned revisions with effective dates, point-in-time reads, history, and audit/outbox events | Surface policy history in the admin UI and resolve timesheet projections through the policy effective at the booked date |
| Organization catalogs | Typed workflow for editable departments, locations, role profiles, teams, work patterns, manager delegations, and employment contracts; local cache fallback remains | Feed employment contracts into timesheet and planning projections |
| Notifications | Dedicated notification/preference workflow endpoints with backend tables, read-state commands, audit/outbox events, and local cache fallback | Server delivery pipeline and digest jobs |
| Planning | Backend-first planning package query over native users/teams and compatibility request documents; local projection fallback remains | Normalize request/approval tables and add persisted capacity/coverage snapshots |
| Reports | Backend-first report package query over native users, native time bookings, timesheet snapshots, policies, and compatibility request/clock aggregates; local package fallback remains | Retained export evidence with server-generated CSV/PDF artifacts |

## Migration Order

1. Renderer-backed PDF generation and close-period controls.
2. Notification delivery/read state.
4. Persisted planning capacity and coverage snapshots.
5. Feed employment contracts into timesheet and planning projections.
6. Scoped user directory refinements for manager/employee views.

Each slice should add:

- Domain model or explicit document contract.
- Command/query handler.
- Permission checks in the application layer.
- API endpoint.
- Audit and outbox events in the same transaction.
- Frontend application workflow that calls the backend first and falls back
  locally only for offline-safe cases.
- Domain/application/API/e2e tests.
