using FlowPro.Application.Identity;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class IdentitySessionRepository(FlowProDbContext dbContext)
    : IIdentitySessionRepository
{
    public async Task<CurrentSession?> GetCurrentSessionAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var session = await (
            from user in dbContext.Users.AsNoTracking()
            join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
            where user.TenantId == tenantId
                && user.Id == userId
                && user.Status == UserStatus.Active
                && tenant.IsActive
            select new
            {
                TenantId = tenant.Id,
                TenantSlug = tenant.Slug,
                TenantName = tenant.Name,
                UserId = user.Id,
                user.ExternalSubject,
                user.Email,
                user.DisplayName,
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return null;
        }

        string[] roles = await (
            from userRole in dbContext.UserRoles.AsNoTracking()
            join role in dbContext.Roles.AsNoTracking()
                on new { userRole.TenantId, userRole.RoleId }
                equals new { role.TenantId, RoleId = role.Id }
            where userRole.TenantId == tenantId && userRole.UserId == userId
            select role.Key)
            .Distinct()
            .OrderBy(role => role)
            .ToArrayAsync(cancellationToken);

        string[] permissions = await (
            from userRole in dbContext.UserRoles.AsNoTracking()
            join rolePermission in dbContext.RolePermissions.AsNoTracking()
                on new { userRole.TenantId, userRole.RoleId }
                equals new { rolePermission.TenantId, rolePermission.RoleId }
            join grantedPermission in dbContext.Permissions.AsNoTracking()
                on rolePermission.PermissionId equals grantedPermission.Id
            where userRole.TenantId == tenantId && userRole.UserId == userId
            select grantedPermission.Key)
            .Distinct()
            .OrderBy(permission => permission)
            .ToArrayAsync(cancellationToken);

        return new CurrentSession(
            session.TenantId,
            session.TenantSlug,
            session.TenantName,
            session.UserId,
            session.ExternalSubject,
            session.Email,
            session.DisplayName,
            roles,
            permissions);
    }
}
