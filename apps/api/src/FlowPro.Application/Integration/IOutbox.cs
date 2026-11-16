using FlowPro.Domain.Integration;

namespace FlowPro.Application.Integration;

public interface IOutboxWriter
{
    void Add(OutboxMessage message);
}

public interface IOutboxReader
{
    Task<IReadOnlyList<OutboxMessage>> ListChangesAsync(
        Guid tenantId,
        long afterSequence,
        int limit,
        CancellationToken cancellationToken);
}
