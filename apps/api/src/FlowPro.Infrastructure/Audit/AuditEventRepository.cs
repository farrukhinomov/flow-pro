using FlowPro.Application.Audit;
using FlowPro.Domain.Audit;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Audit;

internal sealed class AuditEventRepository(FlowProDbContext dbContext)
    : IAuditEventRepository
{
    public async Task<IReadOnlyList<AuditEvent>> ListAsync(
        Guid tenantId,
        AuditEventFilter? filter,
        int offset,
        int limit,
        CancellationToken cancellationToken)
    {
        IQueryable<AuditEvent> query = dbContext.AuditEvents
            .AsNoTracking()
            .Where(auditEvent => auditEvent.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(filter?.AggregateType))
        {
            query = query.Where(auditEvent => auditEvent.AggregateType == filter.AggregateType);
        }

        if (filter?.ActorUserId is { } actorUserId)
        {
            query = query.Where(auditEvent => auditEvent.ActorUserId == actorUserId);
        }

        if (!string.IsNullOrWhiteSpace(filter?.Action))
        {
            query = query.Where(auditEvent => auditEvent.Action == filter.Action);
        }

        if (!string.IsNullOrWhiteSpace(filter?.Search))
        {
            string search = filter.Search.Trim();
            query = query.Where(auditEvent =>
                EF.Functions.ILike(auditEvent.Action, $"%{search}%")
                || EF.Functions.ILike(auditEvent.AggregateType, $"%{search}%")
                || EF.Functions.ILike(auditEvent.DetailsJson, $"%{search}%"));
        }

        return await query
            .OrderByDescending(auditEvent => auditEvent.Sequence)
            .Skip(offset)
            .Take(limit)
            .ToArrayAsync(cancellationToken);
    }
}
