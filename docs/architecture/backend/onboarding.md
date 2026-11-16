# Self-Serve Onboarding

FlowPro provisions its own tenants. An account that authenticates at the identity
provider but belongs to no workspace can create one, after which a four-step
setup wizard configures the minimum the product needs.

This guide covers the `Onboarding` module. For identity and permission
mechanics see [Backend auth](auth.md). For the browser side see
[Frontend auth](../frontend/auth.md).

## Why This Module Exists

Before this module, tenants could only be created by seeding the database. There
was no path from "interested visitor" to "working workspace", which made the
product impossible to sell without manual setup.

## Layering

| Layer | Files |
| --- | --- |
| Domain | `FlowPro.Domain/Onboarding/TenantOnboarding.cs`, `OnboardingStep.cs`, `OnboardingStatus.cs` |
| Domain (changed) | `FlowPro.Domain/Tenancy/Tenant.cs` gained `CountryCode`, `RegionCode`, `UpdateProfile`, `Deactivate` |
| Application | `FlowPro.Application/Onboarding/*` |
| Application (new ports) | `Common/ICurrentPrincipal.cs`, `Common/IProvisioningUnitOfWork.cs` |
| Infrastructure | `FlowPro.Infrastructure/Onboarding/OnboardingRepository.cs`, `Persistence/EfProvisioningUnitOfWork.cs` |
| API | `FlowPro.Api/Onboarding/OnboardingEndpoints.cs`, `Authentication/HttpCurrentPrincipal.cs` |

## The Tenantless Window

`ICurrentRequestContext` resolves a `RequestIdentity` only for callers who are
already members of a tenant. Signup happens before that is true, so a second
port exists:

- `ICurrentPrincipal` reads the signed-in account's identifier, email and
  display name from the session.
- `HttpCurrentPrincipal` implements it from the `ClaimsPrincipal`.

`FlowProClaimsTransformation` finds no membership for a new account, so the
session produces no FlowPro identity and every tenant-scoped endpoint keeps
answering 401. The frontend treats that specific 401 on `/auth/session` as the
signup signal rather than an error.

## Row Level Security During Provisioning

Every tenant-owned table enforces `tenant_id = infrastructure.current_tenant_id()`,
which is read from the `flowpro.tenant_id` session setting. Provisioning creates
the tenant it writes into, so there is nothing to read that setting from yet.

`IProvisioningUnitOfWork` solves this: the caller generates the tenant identifier
with `Guid.CreateVersion7()` before the transaction opens, and
`EfProvisioningUnitOfWork` applies it with `set_config` as the first statement in
the transaction. Every subsequent insert then satisfies the existing policies.

`IUnitOfWork` is unchanged and still derives its scope from the authenticated
identity. It cannot be pointed at an arbitrary tenant, which is the property that
makes the split safe.

Two reads in `OnboardingRepository` are deliberately cross-tenant:
`FindActiveUserAsync` and `SlugExistsAsync`. Both run through
`AcrossTenantsAsync`, the explicit way past tenant isolation (see
[architecture](architecture.md#multi-tenancy)).

## What Provisioning Creates

`WorkspaceClaimHandler` writes, in one transaction:

1. `Tenant` with a slug derived from the workspace name, deduplicated with a
   numeric suffix.
2. `Membership` (the owner's membership) linked to the account.
3. `Employee` with personnel number `EMP-001`.
4. Global `Permission` rows for any key in `PermissionKeys.All` that does not
   exist yet. Permissions are global, not tenant scoped, so existing rows are
   reused.
5. Three roles from `PermissionCatalog`: `superadmin`, `manager`, `employee`,
   with their permission bundles. The owner is granted `superadmin`.
6. Organization catalog defaults: an `HQ` location, a `General` team, the
   not-configured and standard work patterns, and five role profiles.
7. `TenantOnboarding` in `InProgress`.
8. An audit event and outbox message for `onboarding.workspace.claimed.v1`.

## The Wizard State Machine

`TenantOnboarding` owns progress only. Configuration written by a step belongs to
the module that already owns that data, so onboarding never becomes a second
source of truth for settings.

| Step | Owns | Written by |
| --- | --- | --- |
| `company` | Tenant profile, default location time zone, default work pattern | `SaveCompanyProfileCommand` |
| `team` | Nothing | Existing `InviteUserCommand`, called per address by the client |
| `absences` | Nothing | Existing attendance policy publish |
| `first-clock-in` | Nothing | Existing attendance clock command |

Steps may be resolved in any order so the wizard supports back navigation, and
re-resolving a step overwrites the previous outcome. `Complete` records any step
the user never reached as skipped, so the finished record always explains how the
workspace was set up.

Workspaces created before this module have no `TenantOnboarding` row.
`GetOnboardingStateQuery` reports those as already complete so existing customers
are never dropped into a wizard.

## Endpoints

| Method | Route | Authorization |
| --- | --- | --- |
| GET | `/api/v1/onboarding/workspace` | Authenticated |
| POST | `/api/v1/onboarding/workspace` | Authenticated, rate limited |
| GET | `/api/v1/onboarding/state` | Authenticated |
| PUT | `/api/v1/onboarding/steps/company` | `organization.manage` |
| POST | `/api/v1/onboarding/steps/{step}/resolve` | `organization.manage` |
| POST | `/api/v1/onboarding/complete` | `organization.manage` |

The two workspace routes cannot require a tenant-scoped permission, because the
caller has no tenant when they are used. A signed-in account is the only gate, plus the `workspace-claim` rate limit policy: five attempts per
hour per subject, no queue, because the endpoint creates tenants.

Reading setup state requires no permission beyond a resolved tenant identity, so
non-admin members can be routed past the wizard rather than into it.

## Error Codes

| Code | Status | Meaning |
| --- | --- | --- |
| `onboarding.workspace_already_claimed` | 409 | The subject already belongs to a workspace |
| `onboarding.slug_unavailable` | 409 | No free slug could be derived from the name |
| `onboarding.workspace_name_required` | 400 | Name shorter than 2 characters |
| `onboarding.workspace_name_too_long` | 400 | Name longer than 200 characters |
| `onboarding.company_name_invalid` | 400 | Company name outside 2-200 characters |
| `onboarding.time_zone_invalid` | 400 | Not a resolvable IANA time zone |
| `onboarding.weekly_hours_invalid` | 400 | Outside 1-60 hours |
| `onboarding.step_unknown` | 400 | Unrecognized step segment |
| `onboarding.not_found` | 404 | Workspace has no setup in progress |
| `onboarding.already_completed` | 409 | Setup already finished |

## Working Time Limits

`OnboardingDefaults.MaxWeeklyHours` is 60. The German Arbeitszeitgesetz caps the
working week at 48 hours averaged over six months, with 60 as the absolute
ceiling, so configuration above that is refused rather than stored and reported
as a violation later.

## Local And E2E Testing

`DevelopmentAuthenticationHandler` accepts an `X-FlowPro-Subject` header. When
present, it issues a principal with `sub`, `email`, and `name` claims and no
tenant or user claims, which is the state a newly registered account is in.
Without the header it behaves as before and returns a tenant member.

```text
X-FlowPro-Subject: signup-test-1
X-FlowPro-Email: founder@example.test
X-FlowPro-Name: Test Founder
```

## Tests

- `FlowPro.Domain.Tests/Onboarding/TenantOnboardingTests.cs`
- `FlowPro.Domain.Tests/Tenancy/TenantTests.cs`
- `FlowPro.Application.Tests/Onboarding/WorkspaceClaimHandlerTests.cs`
- `FlowPro.Application.Tests/Onboarding/OnboardingWorkflowHandlerTests.cs`
- `FlowPro.Application.Tests/Onboarding/OnboardingSlugTests.cs`
- `FlowPro.Architecture.Tests/ArchitectureDependencyTests.cs` asserts the write
  steps require `organization.manage` and that the claim route is rate limited.

## Migration

`20260730120000_AddSelfServeOnboarding` creates the `onboarding` schema and
`tenant_onboardings` table, adds `country_code` and `region_code` to
`tenancy.tenants`, and enables the `tenant_isolation` policy on the new table.

It was authored by hand, so the `[Migration]` attribute the tooling normally
emits into a companion Designer file is declared on the migration class instead.
Running `dotnet ef migrations add AddSelfServeOnboarding` produces the same
schema from `TenantOnboardingConfiguration` and the updated `Tenant` aggregate if
you would rather regenerate it.
