namespace FlowPro.Infrastructure.Email;

/// <summary>Outgoing mail settings. Mail is off until <see cref="SmtpOptions.Host" /> is set.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>The sender address, for example <c>no-reply@flowpro.example.com</c>.</summary>
    public string? From { get; init; }

    public string FromName { get; init; } = "FlowPro";

    public SmtpOptions Smtp { get; init; } = new();

    public bool IsEnabled => !string.IsNullOrWhiteSpace(Smtp.Host);
}

public sealed class SmtpOptions
{
    public string? Host { get; init; }

    public int Port { get; init; } = 587;

    /// <summary>Leave empty for a relay that does not ask for credentials.</summary>
    public string? Username { get; init; }

    public string? Password { get; init; }

    /// <summary>
    /// <see cref="SmtpSecurity.StartTls" /> by default. <see cref="SmtpSecurity.None" /> is only
    /// for a local mail catcher such as Mailpit.
    /// </summary>
    public SmtpSecurity Security { get; init; } = SmtpSecurity.StartTls;
}

public enum SmtpSecurity
{
    StartTls,
    SslOnConnect,
    None,
}
