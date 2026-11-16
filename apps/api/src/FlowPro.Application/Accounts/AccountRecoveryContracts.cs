using FlowPro.Application.Common;

namespace FlowPro.Application.Accounts;

/// <summary>Asks for a password reset link. Succeeds whether or not the email has an account.</summary>
public sealed record RequestPasswordResetCommand(string Email, ClientContext Client)
    : ICommand<EmailRequestAccepted>;

public sealed record ResetPasswordCommand(string Token, string NewPassword, ClientContext Client)
    : ICommand<PasswordResetCompleted>;

public sealed record VerifyEmailCommand(string Token, ClientContext Client)
    : ICommand<EmailVerificationCompleted>;

/// <summary>Sends a new confirmation link to a signed-in account whose email is not confirmed.</summary>
public sealed record ResendEmailVerificationCommand(Guid AccountId, ClientContext Client)
    : ICommand<EmailRequestAccepted>;

public sealed record EmailRequestAccepted;

/// <param name="SessionsEnded">How many signed-in sessions the reset ended.</param>
public sealed record PasswordResetCompleted(int SessionsEnded);

public sealed record EmailVerificationCompleted(string Email);

/// <summary>Moves the account to the address the link was sent to.</summary>
public sealed record ConfirmEmailChangeCommand(string Token, ClientContext Client)
    : ICommand<EmailChangeCompleted>;

public sealed record EmailChangeCompleted(string Email);

/// <summary>How account emails are built. Bound from configuration by the host.</summary>
public sealed class AccountEmailOptions
{
    public const string SectionName = "Authentication:Email";

    /// <summary>
    /// Where people open the web app, used to build the links in emails. It is configured rather
    /// than taken from the request, so a forged <c>Host</c> header cannot point a reset link at
    /// someone else's site.
    /// </summary>
    public Uri? AppBaseUrl { get; init; }

    public TimeSpan EmailVerificationLifetime { get; init; } = TimeSpan.FromDays(2);

    public TimeSpan PasswordResetLifetime { get; init; } = TimeSpan.FromHours(1);

    public TimeSpan EmailChangeLifetime { get; init; } = TimeSpan.FromDays(1);

    public TimeSpan InvitationLifetime { get; init; } = TimeSpan.FromDays(7);
}
