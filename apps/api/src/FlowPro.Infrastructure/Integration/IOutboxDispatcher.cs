namespace FlowPro.Infrastructure.Integration;

public interface IOutboxDispatcher
{
    Task<int> DispatchBatchAsync(int batchSize, CancellationToken cancellationToken);
}
