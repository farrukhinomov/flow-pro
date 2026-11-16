using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// An append-only record of something security-relevant that happened to an account, such as a
/// sign-in, a failed attempt or a lockout.
/// </summary>
/// <remarks>
/// Kept separate from the tenant audit trail because these events happen before any tenant is
/// known, and a failed attempt may not belong to an existing account at all.
/// </remarks>
public sealed class AccountSecurityEvent
{
    private AccountSecurityEvent()
    {
    }

    public AccountSecurityEvent(
        string type,
        Guid? accountId,
        string? email,
        string? ipAddress,
        string? userAgent,
        DateTimeOffset occurredAt)
    {
        Id = Guid.CreateVersion7();
        Type = Guard.Required(type, nameof(type), 60);
        AccountId = accountId;
        Email = Truncate(email?.ToLowerInvariant(), 320);
        IpAddress = Truncate(ipAddress, 64);
        UserAgent = Truncate(userAgent, 400);
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }

    public string Type { get; private set; } = string.Empty;

    public Guid? AccountId { get; private set; }

    /// <summary>The email that was used, which may not match any account.</summary>
    public string? Email { get; private set; }

    public string? IpAddress { get; private set; }

    public string? UserAgent { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    private static string? Truncate(string? value, int maxLength)
    {
        string? trimmed = value?.Trim();

        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}

public static class AccountSecurityEventTypes
{
    public const string Registered = "account.registered";
    public const string SignedIn = "account.signed_in";
    public const string SignInFailed = "account.sign_in_failed";
    public const string LockedOut = "account.locked_out";
    public const string SignedOut = "account.signed_out";
    public const string EmailVerificationSent = "account.email_verification_sent";
    public const string EmailVerified = "account.email_verified";
    public const string PasswordResetRequested = "account.password_reset_requested";
    public const string PasswordReset = "account.password_reset";
    public const string PasswordChanged = "account.password_changed";
    public const string SessionRevoked = "account.session_revoked";
    public const string EmailChangeRequested = "account.email_change_requested";
    public const string EmailChanged = "account.email_changed";
    public const string InvitationAccepted = "account.invitation_accepted";
    public const string TwoFactorEnabled = "account.two_factor_enabled";
    public const string TwoFactorDisabled = "account.two_factor_disabled";
    public const string TwoFactorFailed = "account.two_factor_failed";
    public const string RecoveryCodesGenerated = "account.recovery_codes_generated";
    public const string RecoveryCodeUsed = "account.recovery_code_used";
}
