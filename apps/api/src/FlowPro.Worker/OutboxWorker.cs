using FlowPro.Infrastructure.Integration;

namespace FlowPro.Worker;

public sealed partial class OutboxWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<OutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
                IOutboxDispatcher dispatcher = scope.ServiceProvider.GetRequiredService<IOutboxDispatcher>();
                int dispatched = await dispatcher.DispatchBatchAsync(50, stoppingToken);
                TimeSpan delay = dispatched == 0 ? TimeSpan.FromSeconds(2) : TimeSpan.FromMilliseconds(100);
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                LogOutboxFailure(logger, exception);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox dispatch failed.")]
    private static partial void LogOutboxFailure(ILogger logger, Exception exception);
}
