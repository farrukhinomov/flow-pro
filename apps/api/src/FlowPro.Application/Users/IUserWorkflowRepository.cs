using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Users;

public interface IUserWorkflowRepository
{
    Task<IReadOnlyList<UserDirectoryProjection>> ListAsync(
        Guid tenantId,
        CancellationToken cancellationToken);

    Task<UserDirectoryProjection?> FindProjectionAsync(
        Guid tenantId,
        string userId,
        CancellationToken cancellationToken);

    Task<UserDirectoryEntities?> FindEntitiesByClientIdOrEmailAsync(
        Guid tenantId,
        string clientId,
        string email,
        CancellationToken cancellationToken);

    Task<Role?> FindRoleByKeyAsync(
        Guid tenantId,
        string key,
        CancellationToken cancellationToken);

    Task<Team?> FindTeamByNameAsync(
        Guid tenantId,
        string name,
        CancellationToken cancellationToken);

    void AddUser(Membership user);

    void AddEmployee(Employee employee);

    void AddRole(Role role);

    void AddTeam(Team team);

    void ReplaceUserRole(Guid tenantId, Guid userId, Guid roleId);
}

public sealed record UserDirectoryEntities(
    Membership User,
    Employee Employee);

public sealed record UserDirectoryProjection(
    Membership User,
    Employee Employee,
    Role? Role,
    Team? Team);
