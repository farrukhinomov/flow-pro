namespace FlowPro.Application.Identity;

public interface IPermissionChecker
{
    Task<bool> HasPermissionAsync(
        Guid tenantId,
        Guid userId,
        string permission,
        CancellationToken cancellationToken);
}
