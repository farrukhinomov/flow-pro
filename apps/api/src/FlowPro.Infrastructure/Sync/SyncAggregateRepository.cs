using FlowPro.Application.Sync;
using FlowPro.Domain.Sync;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Sync;

internal sealed class SyncAggregateRepository(FlowProDbContext dbContext) : ISyncAggregateRepository
{
    public Task<ClientAggregate?> FindAsync(
        Guid tenantId,
        string aggregateType,
        string aggregateId,
        CancellationToken cancellationToken) =>
        dbContext.ClientAggregates
            .SingleOrDefaultAsync(
                aggregate => aggregate.TenantId == tenantId
                    && aggregate.AggregateType == aggregateType
                    && aggregate.AggregateId == aggregateId,
                cancellationToken);

    public async Task<IReadOnlyList<ClientAggregate>> ListAsync(
        Guid tenantId,
        string aggregateType,
        int offset,
        int limit,
        bool includeDeleted,
        Guid? ownerUserId,
        bool ownerOnly,
        CancellationToken cancellationToken) =>
        await dbContext.ClientAggregates
            .AsNoTracking()
            .Where(aggregate => aggregate.TenantId == tenantId
                && aggregate.AggregateType == aggregateType
                && (includeDeleted || !aggregate.IsDeleted)
                && (!ownerOnly || aggregate.OwnerUserId == ownerUserId))
            .OrderByDescending(aggregate => aggregate.UpdatedAt)
            .ThenBy(aggregate => aggregate.AggregateId)
            .Skip(offset)
            .Take(limit)
            .ToArrayAsync(cancellationToken);

    public void Add(ClientAggregate aggregate) => dbContext.ClientAggregates.Add(aggregate);
}
