using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Tests.Onboarding;

internal sealed class FakeOnboardingRepository : IOnboardingRepository
{
    public List<Tenant> Tenants { get; } = [];

    public List<Membership> Users { get; } = [];

    public List<Employee> Employees { get; } = [];

    public List<TenantOnboarding> Onboardings { get; } = [];

    public List<Permission> Permissions { get; } = [];

    public List<Role> Roles { get; } = [];

    public List<UserRole> UserRoles { get; } = [];

    public List<RolePermission> RolePermissions { get; } = [];

    public List<Team> Teams { get; } = [];

    public List<Location> Locations { get; } = [];

    public List<WorkPattern> WorkPatterns { get; } = [];

    public List<RoleProfile> RoleProfiles { get; } = [];

    public HashSet<string> ReservedSlugs { get; } = new(StringComparer.Ordinal);

    public Task<Membership?> FindActiveUserAsync(
        PrincipalIdentity principal,
        CancellationToken cancellationToken) =>
        Task.FromResult(Users.FirstOrDefault(user =>
            user.Status == UserStatus.Active
            && (principal.AccountId is { } accountId
                ? user.AccountId == accountId
                : user.ExternalSubject == principal.ExternalSubject)));

    public Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken) =>
        Task.FromResult(ReservedSlugs.Contains(slug)
            || Tenants.Any(tenant => tenant.Slug == slug));

    public Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken) =>
        Task.FromResult(Tenants.FirstOrDefault(tenant => tenant.Id == tenantId));

    public Task<TenantOnboarding?> FindOnboardingAsync(
        Guid tenantId,
        CancellationToken cancellationToken) =>
        Task.FromResult(Onboardings.FirstOrDefault(onboarding => onboarding.TenantId == tenantId));

    public Task<Employee?> FindEmployeeByUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        Task.FromResult(Employees.FirstOrDefault(employee =>
            employee.TenantId == tenantId && employee.UserId == userId));

    public Task<IReadOnlyList<Permission>> ListPermissionsAsync(
        IReadOnlyCollection<string> keys,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Permission>>(
            Permissions.Where(permission => keys.Contains(permission.Key)).ToArray());

    public Task<Location?> FindLocationByCodeAsync(
        Guid tenantId,
        string code,
        CancellationToken cancellationToken) =>
        Task.FromResult(Locations.FirstOrDefault(location =>
            location.TenantId == tenantId && location.Code == code));

    public Task<WorkPattern?> FindWorkPatternByExternalIdAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        Task.FromResult(WorkPatterns.FirstOrDefault(pattern =>
            pattern.TenantId == tenantId && pattern.ExternalId == externalId));

    public void AddTenant(Tenant tenant) => Tenants.Add(tenant);

    public void AddUser(Membership user) => Users.Add(user);

    public void AddEmployee(Employee employee) => Employees.Add(employee);

    public void AddOnboarding(TenantOnboarding onboarding) => Onboardings.Add(onboarding);

    public void AddPermission(Permission permission) => Permissions.Add(permission);

    public void AddRole(Role role) => Roles.Add(role);

    public void AddUserRole(UserRole userRole) => UserRoles.Add(userRole);

    public void AddRolePermission(RolePermission rolePermission) =>
        RolePermissions.Add(rolePermission);

    public void AddTeam(Team team) => Teams.Add(team);

    public void AddLocation(Location location) => Locations.Add(location);

    public void AddWorkPattern(WorkPattern workPattern) => WorkPatterns.Add(workPattern);

    public void AddRoleProfile(RoleProfile roleProfile) => RoleProfiles.Add(roleProfile);
}

internal sealed class FakeCurrentPrincipal(PrincipalIdentity? principal) : ICurrentPrincipal
{
    public PrincipalIdentity GetRequiredPrincipal() =>
        principal ?? throw new FlowProUnauthorizedException();

    public PrincipalIdentity? TryGetPrincipal() => principal;
}

internal sealed class FakeOnboardingRequestContext(Guid tenantId, Guid userId)
    : ICurrentRequestContext
{
    public RequestIdentity GetRequiredIdentity() => new(tenantId, userId);

    public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
}

internal sealed class FakeOnboardingUnitOfWork : IUnitOfWork
{
    public Task<TResult> ExecuteAsync<TResult>(
        Func<CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken) =>
        operation(cancellationToken);
}

internal sealed class FakeProvisioningUnitOfWork : IProvisioningUnitOfWork
{
    public List<Guid> ScopedTenantIds { get; } = [];

    public Task<TResult> ExecuteInTenantScopeAsync<TResult>(
        Guid tenantId,
        Func<CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken)
    {
        ScopedTenantIds.Add(tenantId);
        return operation(cancellationToken);
    }
}

internal sealed class FakeOnboardingAuditWriter : IAuditWriter
{
    public List<AuditEvent> Events { get; } = [];

    public void Add(AuditEvent auditEvent) => Events.Add(auditEvent);
}

internal sealed class FakeOnboardingOutbox : IOutboxWriter
{
    public List<OutboxMessage> Messages { get; } = [];

    public void Add(OutboxMessage message) => Messages.Add(message);
}

internal sealed class FixedOnboardingTimeProvider(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = now;

    public override DateTimeOffset GetUtcNow() => Now;
}
