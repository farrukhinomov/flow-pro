using FlowPro.Application.Common;

namespace FlowPro.Application.Operations;

public sealed record GetOperationsHealthQuery : IQuery<OperationsHealthDto>;

public sealed record OperationsHealthDto(
    DateTimeOffset GeneratedAt,
    int PendingOutboxCount,
    int FailedOutboxCount,
    DateTimeOffset? OldestPendingOutboxAt,
    DateTimeOffset? LastProcessedOutboxAt,
    string? LastOutboxError,
    int AuditEventCount,
    DateTimeOffset? LastAuditEventAt,
    int ClientAggregateCount,
    DateTimeOffset? LastProjectionUpdatedAt,
    string Status);

public interface IOperationsHealthRepository
{
    Task<OperationsHealthSnapshot> GetSnapshotAsync(
        Guid tenantId,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken);
}

public sealed record OperationsHealthSnapshot(
    DateTimeOffset GeneratedAt,
    int PendingOutboxCount,
    int FailedOutboxCount,
    DateTimeOffset? OldestPendingOutboxAt,
    DateTimeOffset? LastProcessedOutboxAt,
    string? LastOutboxError,
    int AuditEventCount,
    DateTimeOffset? LastAuditEventAt,
    int ClientAggregateCount,
    DateTimeOffset? LastProjectionUpdatedAt);
