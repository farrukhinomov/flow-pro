using System.Threading.Channels;
using FlowPro.Application.Accounts;
using Microsoft.Extensions.Logging;

namespace FlowPro.Infrastructure.Email;

/// <summary>
/// An in-memory queue between request handlers and <see cref="EmailDispatcher" />.
/// </summary>
/// <remarks>
/// Messages that are still queued when the process stops are lost. That is acceptable for the
/// mail this queue carries: confirmation and reset links, which the person can ask for again.
/// </remarks>
public sealed partial class EmailQueue(ILogger<EmailQueue> logger) : IEmailQueue
{
    private const int Capacity = 500;

    private readonly Channel<EmailMessage> channel = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(Capacity)
        {
            FullMode = BoundedChannelFullMode.DropWrite,
            SingleReader = true,
        });

    public ChannelReader<EmailMessage> Reader => channel.Reader;

    public void Enqueue(EmailMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);

        if (!channel.Writer.TryWrite(message))
        {
            LogQueueFull(logger, Capacity);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The email queue is full ({Capacity} messages); a message was dropped.")]
    private static partial void LogQueueFull(ILogger logger, int capacity);
}
