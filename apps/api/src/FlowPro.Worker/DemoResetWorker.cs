using FlowPro.Application.Demo;

namespace FlowPro.Worker;

/// <summary>
/// Seeds the public demo on first start and wipes and seeds it again every night. Does nothing
/// unless <see cref="DemoOptions.Enabled" /> is set.
/// </summary>
/// <remarks>
/// The worker runs once per deployment, unlike the API, so the reset never runs twice at the same
/// time.
/// </remarks>
public sealed partial class DemoResetWorker(
    IServiceScopeFactory scopeFactory,
    DemoOptions options,
    TimeProvider timeProvider,
    ILogger<DemoResetWorker> logger) : BackgroundService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Enabled)
        {
            return;
        }

        bool firstRun = true;

        while (!stoppingToken.IsCancellationRequested)
        {
            TimeSpan wait;

            try
            {
                await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
                DemoReset reset = scope.ServiceProvider.GetRequiredService<DemoReset>();
                DemoResetOutcome outcome = await reset.ResetAsync(onlyIfMissing: firstRun, stoppingToken);

                if (outcome == DemoResetOutcome.RefusedOtherWorkspaces)
                {
                    LogRefused(logger);
                    return;
                }

                if (outcome == DemoResetOutcome.Reset)
                {
                    LogReset(logger);
                }

                firstRun = false;
                wait = DemoSchedule.UntilNext(options.ResetAtUtc, timeProvider.GetUtcNow());
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // For example while the database is not migrated yet during a deployment.
                LogFailure(logger, exception);
                wait = RetryDelay;
            }

            try
            {
                await Task.Delay(wait, timeProvider, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "The demo workspace was wiped and seeded again.")]
    private static partial void LogReset(ILogger logger);

    [LoggerMessage(
        Level = LogLevel.Critical,
        Message = "Demo:Enabled is set, but the database holds other workspaces, so it is not wiped. "
            + "Turn the demo off, or point it at its own database.")]
    private static partial void LogRefused(ILogger logger);

    [LoggerMessage(Level = LogLevel.Error, Message = "The demo reset failed; trying again in five minutes.")]
    private static partial void LogFailure(ILogger logger, Exception exception);
}
