using FlowPro.Application.Operations;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Operations;

internal sealed class OperationsHealthRepository(FlowProDbContext dbContext) : IOperationsHealthRepository
{
    public async Task<OperationsHealthSnapshot> GetSnapshotAsync(
        Guid tenantId,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken)
    {
        IQueryable<Domain.Integration.OutboxMessage> tenantOutbox = dbContext.OutboxMessages
            .AsNoTracking()
            .Where(message => message.TenantId == tenantId);

        int pendingOutboxCount = await tenantOutbox
            .CountAsync(message => message.ProcessedAt == null, cancellationToken);
        int failedOutboxCount = await tenantOutbox
            .CountAsync(message => message.ProcessedAt == null && message.LastError != null, cancellationToken);
        DateTimeOffset? oldestPendingOutboxAt = await tenantOutbox
            .Where(message => message.ProcessedAt == null)
            .MinAsync(message => (DateTimeOffset?)message.OccurredAt, cancellationToken);
        DateTimeOffset? lastProcessedOutboxAt = await tenantOutbox
            .Where(message => message.ProcessedAt != null)
            .MaxAsync(message => message.ProcessedAt, cancellationToken);
        string? lastOutboxError = await tenantOutbox
            .Where(message => message.LastError != null)
            .OrderByDescending(message => message.OccurredAt)
            .Select(message => message.LastError)
            .FirstOrDefaultAsync(cancellationToken);

        int auditEventCount = await dbContext.AuditEvents
            .AsNoTracking()
            .CountAsync(auditEvent => auditEvent.TenantId == tenantId, cancellationToken);
        DateTimeOffset? lastAuditEventAt = await dbContext.AuditEvents
            .AsNoTracking()
            .Where(auditEvent => auditEvent.TenantId == tenantId)
            .MaxAsync(auditEvent => (DateTimeOffset?)auditEvent.OccurredAt, cancellationToken);

        int clientAggregateCount = await dbContext.ClientAggregates
            .AsNoTracking()
            .CountAsync(aggregate => aggregate.TenantId == tenantId && !aggregate.IsDeleted, cancellationToken);
        DateTimeOffset? lastProjectionUpdatedAt = await dbContext.ClientAggregates
            .AsNoTracking()
            .Where(aggregate => aggregate.TenantId == tenantId)
            .MaxAsync(aggregate => (DateTimeOffset?)aggregate.UpdatedAt, cancellationToken);

        return new OperationsHealthSnapshot(
            generatedAt,
            pendingOutboxCount,
            failedOutboxCount,
            oldestPendingOutboxAt,
            lastProcessedOutboxAt,
            lastOutboxError,
            auditEventCount,
            lastAuditEventAt,
            clientAggregateCount,
            lastProjectionUpdatedAt);
    }
}
