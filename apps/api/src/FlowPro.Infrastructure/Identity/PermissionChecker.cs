using FlowPro.Application.Identity;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class PermissionChecker(FlowProDbContext dbContext) : IPermissionChecker
{
    public Task<bool> HasPermissionAsync(
        Guid tenantId,
        Guid userId,
        string permission,
        CancellationToken cancellationToken) =>
        (
            from user in dbContext.Users.AsNoTracking()
            join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
            join userRole in dbContext.UserRoles.AsNoTracking()
                on new { user.TenantId, UserId = user.Id }
                equals new { userRole.TenantId, userRole.UserId }
            join rolePermission in dbContext.RolePermissions.AsNoTracking()
                on new { userRole.TenantId, userRole.RoleId }
                equals new { rolePermission.TenantId, rolePermission.RoleId }
            join grantedPermission in dbContext.Permissions.AsNoTracking()
                on rolePermission.PermissionId equals grantedPermission.Id
            where user.TenantId == tenantId
                && user.Id == userId
                && user.Status == UserStatus.Active
                && tenant.IsActive
                && grantedPermission.Key == permission
            select grantedPermission
        ).AnyAsync(cancellationToken);
}
