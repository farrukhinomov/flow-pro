using FlowPro.Application.Accounts;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Text;

namespace FlowPro.Infrastructure.Email;

/// <summary>Delivers one message. Throws when delivery fails, so the dispatcher can retry.</summary>
public interface IEmailTransport
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

/// <summary>Sends through an SMTP server with MailKit.</summary>
internal sealed class SmtpEmailTransport(IOptions<EmailOptions> options) : IEmailTransport
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        EmailOptions settings = options.Value;
        using MimeMessage mime = new();
        mime.From.Add(new MailboxAddress(settings.FromName, settings.From!));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        mime.Body = new TextPart(TextFormat.Plain) { Text = message.TextBody };

        using SmtpClient client = new();
        await client.ConnectAsync(
            settings.Smtp.Host!,
            settings.Smtp.Port,
            settings.Smtp.Security switch
            {
                SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
                SmtpSecurity.None => SecureSocketOptions.None,
                _ => SecureSocketOptions.StartTls,
            },
            cancellationToken);

        if (!string.IsNullOrEmpty(settings.Smtp.Username))
        {
            await client.AuthenticateAsync(
                settings.Smtp.Username,
                settings.Smtp.Password ?? string.Empty,
                cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
    }
}

/// <summary>Used when no SMTP server is configured: notes that a message was not sent.</summary>
/// <remarks>The message body is never logged, because it contains a single-use secret.</remarks>
internal sealed partial class DisabledEmailTransport(ILogger<DisabledEmailTransport> logger) : IEmailTransport
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        LogNotSent(logger, message.Subject);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email is not configured (Email:Smtp:Host); \"{Subject}\" was not sent.")]
    private static partial void LogNotSent(ILogger logger, string subject);
}
