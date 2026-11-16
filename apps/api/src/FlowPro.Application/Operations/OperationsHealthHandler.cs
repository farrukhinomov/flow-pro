using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Application.Operations;

public sealed class OperationsHealthHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IOperationsHealthRepository repository,
    TimeProvider timeProvider)
    : IQueryHandler<GetOperationsHealthQuery, OperationsHealthDto>
{
    public async Task<OperationsHealthDto> HandleAsync(
        GetOperationsHealthQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOperationsAccessAsync(identity, cancellationToken);

        OperationsHealthSnapshot snapshot = await repository.GetSnapshotAsync(
            identity.TenantId,
            timeProvider.GetUtcNow(),
            cancellationToken);

        return new OperationsHealthDto(
            snapshot.GeneratedAt,
            snapshot.PendingOutboxCount,
            snapshot.FailedOutboxCount,
            snapshot.OldestPendingOutboxAt,
            snapshot.LastProcessedOutboxAt,
            snapshot.LastOutboxError,
            snapshot.AuditEventCount,
            snapshot.LastAuditEventAt,
            snapshot.ClientAggregateCount,
            snapshot.LastProjectionUpdatedAt,
            ResolveStatus(snapshot));
    }

    private async Task RequireOperationsAccessAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        if (await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.AuditViewFull,
            cancellationToken))
        {
            return;
        }

        throw new FlowProForbiddenException(
            "operations-health.permission_required",
            $"Permission '{PermissionKeys.AuditViewFull}' is required.");
    }

    private static string ResolveStatus(OperationsHealthSnapshot snapshot)
    {
        if (snapshot.FailedOutboxCount > 0 || !string.IsNullOrWhiteSpace(snapshot.LastOutboxError))
        {
            return "critical";
        }

        return snapshot.PendingOutboxCount > 0 ? "warning" : "ok";
    }
}
