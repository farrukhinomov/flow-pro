using FlowPro.Domain.Integration;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FlowPro.Infrastructure.Integration;

internal sealed partial class OutboxDispatcher(
    FlowProDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<OutboxDispatcher> logger) : IOutboxDispatcher
{
    public async Task<int> DispatchBatchAsync(int batchSize, CancellationToken cancellationToken)
    {
        Microsoft.EntityFrameworkCore.Storage.IExecutionStrategy executionStrategy =
            dbContext.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(
            async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
                    await dbContext.Database.BeginTransactionAsync(cancellationToken);

                // One worker dispatches every workspace's events.
                await dbContext.ActAcrossTenantsInTransactionAsync(cancellationToken);

                List<OutboxMessage> messages = await dbContext.OutboxMessages
                    .FromSqlInterpolated(
                        $"""
                        SELECT *
                        FROM infrastructure.outbox_messages
                        WHERE processed_at IS NULL
                        ORDER BY sequence
                        FOR UPDATE SKIP LOCKED
                        LIMIT {Math.Clamp(batchSize, 1, 100)}
                        """)
                    .ToListAsync(cancellationToken);

                foreach (OutboxMessage message in messages)
                {
                    LogDispatched(
                        logger,
                        message.EventType,
                        message.AggregateType,
                        message.AggregateId);
                    message.MarkProcessed(timeProvider.GetUtcNow());
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return messages.Count;
            });
    }

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Dispatched outbox event {EventType} for {AggregateType} {AggregateId}")]
    private static partial void LogDispatched(
        ILogger logger,
        string eventType,
        string aggregateType,
        Guid aggregateId);
}
