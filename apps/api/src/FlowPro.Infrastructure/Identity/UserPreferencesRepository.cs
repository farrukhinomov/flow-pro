using FlowPro.Application.Identity;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class UserPreferencesRepository(FlowProDbContext dbContext)
    : IUserPreferencesRepository
{
    public Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.Users.SingleOrDefaultAsync(
            user => user.TenantId == tenantId && user.Id == userId,
            cancellationToken);

    public Task<UserPreferencesRecord?> FindPreferencesAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken) =>
        dbContext.UserPreferences.SingleOrDefaultAsync(
            preferences => preferences.TenantId == tenantId
                && preferences.OwnerUserId == ownerUserId,
            cancellationToken);

    public void AddPreferences(UserPreferencesRecord preferences) =>
        dbContext.UserPreferences.Add(preferences);
}
