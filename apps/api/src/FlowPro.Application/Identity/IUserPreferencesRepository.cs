using FlowPro.Domain.Identity;

namespace FlowPro.Application.Identity;

public interface IUserPreferencesRepository
{
    Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<UserPreferencesRecord?> FindPreferencesAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken);

    void AddPreferences(UserPreferencesRecord preferences);
}
