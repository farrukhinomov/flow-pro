using FlowPro.Application.Integration;
using FlowPro.Domain.Integration;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Integration;

internal sealed class OutboxStore(FlowProDbContext dbContext) : IOutboxWriter, IOutboxReader
{
    public void Add(OutboxMessage message) => dbContext.OutboxMessages.Add(message);

    public async Task<IReadOnlyList<OutboxMessage>> ListChangesAsync(
        Guid tenantId,
        long afterSequence,
        int limit,
        CancellationToken cancellationToken) =>
        await dbContext.OutboxMessages
            .AsNoTracking()
            .Where(message => message.TenantId == tenantId && message.Sequence > afterSequence)
            .OrderBy(message => message.Sequence)
            .Take(limit)
            .ToListAsync(cancellationToken);
}
