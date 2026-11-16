using FlowPro.Application.Identity;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Onboarding;

/// <summary>
/// Adds what every workspace needs to a new tenant: the default role bundles, with the owner as
/// superadmin, and the organization catalog defaults every other module reads from.
/// </summary>
/// <remarks>
/// Shared by claiming a workspace and by the public demo, so the demo works exactly like a
/// workspace someone created. The caller adds the owner's user record and runs this inside the
/// tenant's scope.
/// </remarks>
public sealed class WorkspaceProvisioner(IOnboardingRepository repository)
{
    private const string DefaultTimeZoneId = "Europe/Berlin";

    /// <returns>The identifiers of the roles created, by role key.</returns>
    public async Task<IReadOnlyDictionary<string, Guid>> ProvisionAsync(
        Tenant tenant,
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        repository.AddTenant(tenant);
        IReadOnlyDictionary<string, Guid> roleIds = await SeedRolesAsync(tenant.Id, ownerUserId, cancellationToken);
        await SeedOrganizationDefaultsAsync(tenant.Id, ownerUserId, cancellationToken);

        return roleIds;
    }

    private async Task<IReadOnlyDictionary<string, Guid>> SeedRolesAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        Dictionary<string, Guid> roleIds = new(StringComparer.Ordinal);
        IReadOnlyDictionary<string, Guid> permissionIds =
            await EnsurePermissionsAsync(cancellationToken);

        (string Key, string Name, IReadOnlyList<string> Permissions)[] roleDefinitions =
        [
            (PermissionCatalog.SuperadminRoleKey, "Superadmin", PermissionCatalog.SuperadminPermissions),
            (PermissionCatalog.ManagerRoleKey, "Manager", PermissionCatalog.ManagerPermissions),
            (PermissionCatalog.EmployeeRoleKey, "Employee", PermissionCatalog.EmployeePermissions),
        ];

        foreach ((string key, string name, IReadOnlyList<string> permissions) in roleDefinitions)
        {
            Role role = new(tenantId, key, name);
            repository.AddRole(role);
            roleIds[key] = role.Id;

            foreach (string permissionKey in permissions.Distinct(StringComparer.Ordinal))
            {
                repository.AddRolePermission(
                    new RolePermission(tenantId, role.Id, permissionIds[permissionKey]));
            }

            if (key == PermissionCatalog.SuperadminRoleKey)
            {
                repository.AddUserRole(new UserRole(tenantId, ownerUserId, role.Id));
            }
        }

        return roleIds;
    }

    /// <summary>
    /// Permissions are global rather than tenant scoped, so an existing row is reused when present
    /// and only missing keys are inserted.
    /// </summary>
    private async Task<IReadOnlyDictionary<string, Guid>> EnsurePermissionsAsync(
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Permission> existing = await repository.ListPermissionsAsync(
            PermissionKeys.All,
            cancellationToken);
        Dictionary<string, Guid> permissionIds = existing.ToDictionary(
            permission => permission.Key,
            permission => permission.Id,
            StringComparer.Ordinal);

        foreach (string key in PermissionKeys.All.Where(key => !permissionIds.ContainsKey(key)))
        {
            Permission permission = new(key, PermissionCatalog.Describe(key));
            repository.AddPermission(permission);
            permissionIds[key] = permission.Id;
        }

        return permissionIds;
    }

    private async Task SeedOrganizationDefaultsAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (await repository.FindLocationByCodeAsync(tenantId, OnboardingDefaults.DefaultLocationCode, cancellationToken) is null)
        {
            repository.AddLocation(
                new Location(tenantId, OnboardingDefaults.DefaultLocationCode, "Headquarters", DefaultTimeZoneId));
        }

        repository.AddTeam(
            new Team(
                tenantId,
                departmentId: null,
                "GENERAL",
                "General",
                externalId: "team-general",
                managerUserId: ownerUserId));

        repository.AddWorkPattern(
            new WorkPattern(
                tenantId,
                OnboardingDefaults.NotConfiguredWorkPatternExternalId,
                "Not configured",
                0,
                "Fallback until an employment contract is assigned.",
                isActive: true));
        repository.AddWorkPattern(
            new WorkPattern(
                tenantId,
                OnboardingDefaults.DefaultWorkPatternExternalId,
                "Standard week",
                OnboardingDefaults.DefaultWeeklyMinutes,
                "Default weekly working time for the workspace.",
                isActive: true));

        (string ExternalId, string Label, string BaseRole, string Description)[] roleProfiles =
        [
            ("role-profile-superadmin", "Superadmin", "superadmin", "Full workspace administration."),
            ("role-profile-admin", "Admin", "admin", "Policy and integration administration."),
            ("role-profile-hr", "HR", "hr", "Request details and audit trail."),
            ("role-profile-manager", "Manager", "manager", "Team planning details."),
            ("role-profile-employee", "Employee", "employee", "Availability only."),
        ];

        foreach ((string externalId, string label, string baseRole, string description) in roleProfiles)
        {
            repository.AddRoleProfile(
                new RoleProfile(tenantId, externalId, label, baseRole, description, isActive: true));
        }
    }
}
