using FlowPro.Application.Users;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Users;

internal sealed class UserWorkflowRepository(FlowProDbContext dbContext) : IUserWorkflowRepository
{
    public async Task<IReadOnlyList<UserDirectoryProjection>> ListAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        List<Membership> users = await dbContext.Users.AsNoTracking()
            .Where(user => user.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Employee> employees = await dbContext.Employees.AsNoTracking()
            .Where(employee => employee.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<UserRole> userRoles = await dbContext.UserRoles.AsNoTracking()
            .Where(userRole => userRole.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Role> roles = await dbContext.Roles.AsNoTracking()
            .Where(role => role.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Team> teams = await dbContext.Teams.AsNoTracking()
            .Where(team => team.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        Dictionary<Guid, Employee> employeesByUserId = employees.ToDictionary(employee => employee.UserId);
        Dictionary<Guid, Role> rolesById = roles.ToDictionary(role => role.Id);
        Dictionary<Guid, Team> teamsById = teams.ToDictionary(team => team.Id);
        Dictionary<Guid, Role> rolesByUserId = userRoles
            .GroupBy(userRole => userRole.UserId)
            .Select(group => group.First())
            .Where(userRole => rolesById.ContainsKey(userRole.RoleId))
            .ToDictionary(userRole => userRole.UserId, userRole => rolesById[userRole.RoleId]);

        return users
            .Where(user => employeesByUserId.ContainsKey(user.Id))
            .Select(user =>
            {
                Employee employee = employeesByUserId[user.Id];
                return new UserDirectoryProjection(
                    user,
                    employee,
                    rolesByUserId.GetValueOrDefault(user.Id),
                    employee.TeamId is Guid teamId ? teamsById.GetValueOrDefault(teamId) : null);
            })
            .OrderBy(user => user.User.Status == UserStatus.Active ? 0 : 1)
            .ThenBy(user => user.Employee.GivenName)
            .ThenBy(user => user.Employee.FamilyName)
            .ToArray();
    }

    public async Task<UserDirectoryProjection?> FindProjectionAsync(
        Guid tenantId,
        string userId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<UserDirectoryProjection> users = await ListAsync(tenantId, cancellationToken);
        return users.FirstOrDefault(user =>
            user.User.ExternalSubject.Equals(userId, StringComparison.OrdinalIgnoreCase)
            || user.User.Id.ToString().Equals(userId, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<UserDirectoryEntities?> FindEntitiesByClientIdOrEmailAsync(
        Guid tenantId,
        string clientId,
        string email,
        CancellationToken cancellationToken)
    {
        string normalizedEmail = email.ToLowerInvariant();
        Guid? membershipId = Guid.TryParse(clientId, out Guid parsed) ? parsed : null;
        Membership? user = await dbContext.Users
            .Where(user => user.TenantId == tenantId
                && (user.ExternalSubject == clientId
                    || user.Id == membershipId
                    || user.Email == normalizedEmail))
            .OrderByDescending(user => user.ExternalSubject == clientId || user.Id == membershipId)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return null;
        }

        Employee employee = await dbContext.Employees
            .SingleAsync(
                employee => employee.TenantId == tenantId && employee.UserId == user.Id,
                cancellationToken);

        return new UserDirectoryEntities(user, employee);
    }

    public Task<Role?> FindRoleByKeyAsync(
        Guid tenantId,
        string key,
        CancellationToken cancellationToken) =>
        dbContext.Roles.SingleOrDefaultAsync(
            role => role.TenantId == tenantId && role.Key == key,
            cancellationToken);

    public Task<Team?> FindTeamByNameAsync(
        Guid tenantId,
        string name,
        CancellationToken cancellationToken) =>
        dbContext.Teams.SingleOrDefaultAsync(
            team => team.TenantId == tenantId && team.Name == name,
            cancellationToken);

    public void AddUser(Membership user) => dbContext.Users.Add(user);

    public void AddEmployee(Employee employee) => dbContext.Employees.Add(employee);

    public void AddRole(Role role) => dbContext.Roles.Add(role);

    public void AddTeam(Team team) => dbContext.Teams.Add(team);

    public void ReplaceUserRole(Guid tenantId, Guid userId, Guid roleId)
    {
        dbContext.UserRoles.RemoveRange(
            dbContext.UserRoles.Where(userRole =>
                userRole.TenantId == tenantId && userRole.UserId == userId));
        dbContext.UserRoles.Add(new UserRole(tenantId, userId, roleId));
    }
}
