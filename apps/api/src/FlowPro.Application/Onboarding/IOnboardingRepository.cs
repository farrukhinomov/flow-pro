using FlowPro.Application.Common;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Onboarding;

public interface IOnboardingRepository
{
    /// <summary>
    /// Finds an active membership of the caller across all tenants: by account when the caller
    /// signed in with a FlowPro account, otherwise by external subject. Used to stop a second
    /// workspace being provisioned for someone who already has one.
    /// </summary>
    Task<Membership?> FindActiveUserAsync(
        PrincipalIdentity principal,
        CancellationToken cancellationToken);

    Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken);

    Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken);

    Task<TenantOnboarding?> FindOnboardingAsync(Guid tenantId, CancellationToken cancellationToken);

    Task<Employee?> FindEmployeeByUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Permission>> ListPermissionsAsync(
        IReadOnlyCollection<string> keys,
        CancellationToken cancellationToken);

    Task<Location?> FindLocationByCodeAsync(
        Guid tenantId,
        string code,
        CancellationToken cancellationToken);

    Task<WorkPattern?> FindWorkPatternByExternalIdAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    void AddTenant(Tenant tenant);

    void AddUser(Membership user);

    void AddEmployee(Employee employee);

    void AddOnboarding(TenantOnboarding onboarding);

    void AddPermission(Permission permission);

    void AddRole(Role role);

    void AddUserRole(UserRole userRole);

    void AddRolePermission(RolePermission rolePermission);

    void AddTeam(Team team);

    void AddLocation(Location location);

    void AddWorkPattern(WorkPattern workPattern);

    void AddRoleProfile(RoleProfile roleProfile);
}
