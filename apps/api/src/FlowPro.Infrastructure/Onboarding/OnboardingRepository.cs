using FlowPro.Application.Common;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Onboarding;

internal sealed class OnboardingRepository(FlowProDbContext dbContext) : IOnboardingRepository
{
    /// <summary>
    /// Deliberately cross-tenant: signup must know whether the signed-in account already
    /// belongs to some other workspace before provisioning a new one.
    /// </summary>
    /// <remarks>Like claims resolution, this runs before the caller has a workspace.</remarks>
    public Task<Membership?> FindActiveUserAsync(
        PrincipalIdentity principal,
        CancellationToken cancellationToken)
    {
        IQueryable<Membership> active = dbContext.Users
            .AsNoTracking()
            .Where(user => user.Status == UserStatus.Active);

        return dbContext.AcrossTenantsAsync(
            () => (principal.AccountId is { } accountId
                    ? active.Where(user => user.AccountId == accountId)
                    : active.Where(user => user.ExternalSubject == principal.ExternalSubject))
                .FirstOrDefaultAsync(cancellationToken),
            cancellationToken);
    }

    /// <summary>Slugs are unique across every workspace, so the check sees them all.</summary>
    public Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => dbContext.Tenants
                .AsNoTracking()
                .AnyAsync(tenant => tenant.Slug == slug, cancellationToken),
            cancellationToken);

    public Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken) =>
        dbContext.Tenants.SingleOrDefaultAsync(
            tenant => tenant.Id == tenantId,
            cancellationToken);

    public Task<TenantOnboarding?> FindOnboardingAsync(
        Guid tenantId,
        CancellationToken cancellationToken) =>
        dbContext.TenantOnboardings.SingleOrDefaultAsync(
            onboarding => onboarding.TenantId == tenantId,
            cancellationToken);

    public Task<Employee?> FindEmployeeByUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee => employee.TenantId == tenantId && employee.UserId == userId,
            cancellationToken);

    public async Task<IReadOnlyList<Permission>> ListPermissionsAsync(
        IReadOnlyCollection<string> keys,
        CancellationToken cancellationToken) =>
        await dbContext.Permissions
            .Where(permission => keys.Contains(permission.Key))
            .ToArrayAsync(cancellationToken);

    public Task<Location?> FindLocationByCodeAsync(
        Guid tenantId,
        string code,
        CancellationToken cancellationToken) =>
        dbContext.Locations.SingleOrDefaultAsync(
            location => location.TenantId == tenantId && location.Code == code,
            cancellationToken);

    public Task<WorkPattern?> FindWorkPatternByExternalIdAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.WorkPatterns.SingleOrDefaultAsync(
            pattern => pattern.TenantId == tenantId && pattern.ExternalId == externalId,
            cancellationToken);

    public void AddTenant(Tenant tenant) => dbContext.Tenants.Add(tenant);

    public void AddUser(Membership user) => dbContext.Users.Add(user);

    public void AddEmployee(Employee employee) => dbContext.Employees.Add(employee);

    public void AddOnboarding(TenantOnboarding onboarding) =>
        dbContext.TenantOnboardings.Add(onboarding);

    public void AddPermission(Permission permission) => dbContext.Permissions.Add(permission);

    public void AddRole(Role role) => dbContext.Roles.Add(role);

    public void AddUserRole(UserRole userRole) => dbContext.UserRoles.Add(userRole);

    public void AddRolePermission(RolePermission rolePermission) =>
        dbContext.RolePermissions.Add(rolePermission);

    public void AddTeam(Team team) => dbContext.Teams.Add(team);

    public void AddLocation(Location location) => dbContext.Locations.Add(location);

    public void AddWorkPattern(WorkPattern workPattern) => dbContext.WorkPatterns.Add(workPattern);

    public void AddRoleProfile(RoleProfile roleProfile) => dbContext.RoleProfiles.Add(roleProfile);
}
