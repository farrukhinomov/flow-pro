namespace FlowPro.Application.Identity;

public interface IIdentitySessionRepository
{
    Task<CurrentSession?> GetCurrentSessionAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);
}
