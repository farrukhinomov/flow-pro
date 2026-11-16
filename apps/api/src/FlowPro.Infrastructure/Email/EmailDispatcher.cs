using FlowPro.Application.Accounts;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FlowPro.Infrastructure.Email;

/// <summary>Sends queued email in the background, retrying a failed send a few times.</summary>
public sealed partial class EmailDispatcher(
    EmailQueue queue,
    IEmailTransport transport,
    TimeProvider timeProvider,
    ILogger<EmailDispatcher> logger) : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(15)];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (EmailMessage message in queue.Reader.ReadAllAsync(stoppingToken))
        {
            await SendWithRetriesAsync(message, stoppingToken);
        }
    }

    private async Task SendWithRetriesAsync(EmailMessage message, CancellationToken stoppingToken)
    {
        for (int attempt = 0; ; attempt++)
        {
            try
            {
                await transport.SendAsync(message, stoppingToken);
                return;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
#pragma warning disable CA1031 // One undeliverable message must not stop the dispatcher.
            catch (Exception exception)
#pragma warning restore CA1031
            {
                if (attempt >= RetryDelays.Length)
                {
                    LogGaveUp(logger, exception, message.Subject, attempt + 1);
                    return;
                }

                LogRetrying(logger, exception, message.Subject, attempt + 1);
                await Task.Delay(RetryDelays[attempt], timeProvider, stoppingToken);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Sending email \"{Subject}\" failed on attempt {Attempt}; retrying.")]
    private static partial void LogRetrying(ILogger logger, Exception exception, string subject, int attempt);

    [LoggerMessage(Level = LogLevel.Error, Message = "Sending email \"{Subject}\" failed after {Attempts} attempts; giving up.")]
    private static partial void LogGaveUp(ILogger logger, Exception exception, string subject, int attempts);
}
