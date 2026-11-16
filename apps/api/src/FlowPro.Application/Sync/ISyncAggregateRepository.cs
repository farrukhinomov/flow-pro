using FlowPro.Domain.Sync;

namespace FlowPro.Application.Sync;

public interface ISyncAggregateRepository
{
    Task<ClientAggregate?> FindAsync(
        Guid tenantId,
        string aggregateType,
        string aggregateId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ClientAggregate>> ListAsync(
        Guid tenantId,
        string aggregateType,
        int offset,
        int limit,
        bool includeDeleted,
        Guid? ownerUserId,
        bool ownerOnly,
        CancellationToken cancellationToken);

    void Add(ClientAggregate aggregate);
}
