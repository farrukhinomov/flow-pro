using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Organization;

public interface IOrganizationCatalogRepository
{
    Task<OrganizationCatalogSnapshot> LoadAsync(
        Guid tenantId,
        CancellationToken cancellationToken);

    Task<RoleProfile?> FindRoleProfileAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    Task<Department?> FindDepartmentAsync(
        Guid tenantId,
        string externalId,
        string code,
        CancellationToken cancellationToken);

    Task<Location?> FindLocationAsync(
        Guid tenantId,
        string externalId,
        string code,
        CancellationToken cancellationToken);

    Task<Team?> FindTeamAsync(
        Guid tenantId,
        string externalId,
        string name,
        CancellationToken cancellationToken);

    Task<WorkPattern?> FindWorkPatternAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    Task<Membership?> FindUserByExternalIdAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ManagerDelegation>> ListManagerDelegationsAsync(
        Guid tenantId,
        Guid managerUserId,
        CancellationToken cancellationToken);

    void AddRoleProfile(RoleProfile profile);

    void AddDepartment(Department department);

    void AddLocation(Location location);

    void AddTeam(Team team);

    void AddWorkPattern(WorkPattern pattern);

    void AddManagerDelegation(ManagerDelegation delegation);
}

public sealed record OrganizationCatalogSnapshot(
    IReadOnlyList<Department> Departments,
    IReadOnlyList<Location> Locations,
    IReadOnlyList<RoleProfile> RoleProfiles,
    IReadOnlyList<TeamProjection> Teams,
    IReadOnlyList<WorkPattern> WorkPatterns,
    IReadOnlyList<ManagerDelegationProjection> Delegations);

public sealed record TeamProjection(Team Team, Membership? Manager);

public sealed record ManagerDelegationProjection(
    ManagerDelegation Delegation,
    Membership Manager,
    Team Team);
