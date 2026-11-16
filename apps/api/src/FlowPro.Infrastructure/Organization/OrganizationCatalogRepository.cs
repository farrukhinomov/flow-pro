using FlowPro.Application.Organization;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Organization;

internal sealed class OrganizationCatalogRepository(FlowProDbContext dbContext)
    : IOrganizationCatalogRepository
{
    public async Task<OrganizationCatalogSnapshot> LoadAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        List<Department> departments = await dbContext.Departments
            .Where(department => department.TenantId == tenantId)
            .OrderBy(department => department.Name)
            .ToListAsync(cancellationToken);
        List<Location> locations = await dbContext.Locations
            .Where(location => location.TenantId == tenantId)
            .OrderBy(location => location.Name)
            .ToListAsync(cancellationToken);
        List<RoleProfile> roleProfiles = await dbContext.RoleProfiles
            .Where(profile => profile.TenantId == tenantId)
            .OrderBy(profile => profile.Label)
            .ToListAsync(cancellationToken);
        List<Team> teams = await dbContext.Teams
            .Where(team => team.TenantId == tenantId)
            .OrderBy(team => team.Name)
            .ToListAsync(cancellationToken);
        List<WorkPattern> workPatterns = await dbContext.WorkPatterns
            .Where(pattern => pattern.TenantId == tenantId)
            .OrderBy(pattern => pattern.Label)
            .ToListAsync(cancellationToken);
        List<ManagerDelegation> delegations = await dbContext.ManagerDelegations
            .Where(delegation => delegation.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Membership> users = await dbContext.Users
            .Where(user => user.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        Dictionary<Guid, Membership> usersById = users.ToDictionary(user => user.Id);
        Dictionary<Guid, Team> teamsById = teams.ToDictionary(team => team.Id);

        return new OrganizationCatalogSnapshot(
            departments,
            locations,
            roleProfiles,
            teams
                .Select(team => new TeamProjection(
                    team,
                    team.ManagerUserId is Guid managerUserId
                        ? usersById.GetValueOrDefault(managerUserId)
                        : null))
                .ToArray(),
            workPatterns,
            delegations
                .Where(delegation =>
                    usersById.ContainsKey(delegation.ManagerUserId)
                    && teamsById.ContainsKey(delegation.TeamId))
                .Select(delegation => new ManagerDelegationProjection(
                    delegation,
                    usersById[delegation.ManagerUserId],
                    teamsById[delegation.TeamId]))
                .ToArray());
    }

    public Task<RoleProfile?> FindRoleProfileAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.RoleProfiles.SingleOrDefaultAsync(
            profile => profile.TenantId == tenantId && profile.ExternalId == externalId,
            cancellationToken);

    public Task<Department?> FindDepartmentAsync(
        Guid tenantId,
        string externalId,
        string code,
        CancellationToken cancellationToken)
    {
        string normalizedCode = NormalizeCode(code);
        string externalCode = NormalizeSyntheticCode(externalId, "department-");
        return dbContext.Departments.FirstOrDefaultAsync(
            department => department.TenantId == tenantId
                && (department.Code == normalizedCode || department.Code == externalCode),
            cancellationToken);
    }

    public Task<Location?> FindLocationAsync(
        Guid tenantId,
        string externalId,
        string code,
        CancellationToken cancellationToken)
    {
        string normalizedCode = NormalizeCode(code);
        string externalCode = NormalizeSyntheticCode(externalId, "location-");
        return dbContext.Locations.FirstOrDefaultAsync(
            location => location.TenantId == tenantId
                && (location.Code == normalizedCode || location.Code == externalCode),
            cancellationToken);
    }

    public Task<Team?> FindTeamAsync(
        Guid tenantId,
        string externalId,
        string name,
        CancellationToken cancellationToken) =>
        dbContext.Teams
            .OrderByDescending(team => team.ExternalId == externalId)
            .FirstOrDefaultAsync(
                team => team.TenantId == tenantId
                    && (team.ExternalId == externalId || team.Name == name),
                cancellationToken);

    public Task<WorkPattern?> FindWorkPatternAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.WorkPatterns.SingleOrDefaultAsync(
            pattern => pattern.TenantId == tenantId && pattern.ExternalId == externalId,
            cancellationToken);

    public Task<Membership?> FindUserByExternalIdAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.Users.SingleOrDefaultAsync(
            user => user.TenantId == tenantId && user.ExternalSubject == externalId,
            cancellationToken);

    public async Task<IReadOnlyList<ManagerDelegation>> ListManagerDelegationsAsync(
        Guid tenantId,
        Guid managerUserId,
        CancellationToken cancellationToken) =>
        await dbContext.ManagerDelegations
            .Where(delegation => delegation.TenantId == tenantId
                && delegation.ManagerUserId == managerUserId)
            .ToArrayAsync(cancellationToken);

    public void AddRoleProfile(RoleProfile profile) => dbContext.RoleProfiles.Add(profile);

    public void AddDepartment(Department department) => dbContext.Departments.Add(department);

    public void AddLocation(Location location) => dbContext.Locations.Add(location);

    public void AddTeam(Team team) => dbContext.Teams.Add(team);

    public void AddWorkPattern(WorkPattern pattern) => dbContext.WorkPatterns.Add(pattern);

    public void AddManagerDelegation(ManagerDelegation delegation) =>
        dbContext.ManagerDelegations.Add(delegation);

    private static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();

    private static string NormalizeSyntheticCode(string externalId, string prefix) =>
        externalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? NormalizeCode(externalId[prefix.Length..])
            : NormalizeCode(externalId);
}
