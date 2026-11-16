using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// A single-use secret: sent to an email address, to prove the person can read that mailbox
/// (confirming the account's address, resetting a forgotten password, or moving the account to a
/// new address), or held by the browser between the password and the second sign-in step.
/// </summary>
/// <remarks>
/// Like a session token, only the SHA-256 hash of the secret is stored. A token is usable once,
/// until it expires, and only for the purpose it was issued for.
/// </remarks>
public sealed class AccountToken
{
    private AccountToken()
    {
    }

    public AccountToken(
        Guid accountId,
        string purpose,
        string tokenHash,
        DateTimeOffset now,
        TimeSpan lifetime,
        string? newEmail = null)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(lifetime, TimeSpan.Zero);

        if (!AccountTokenPurposes.IsKnown(purpose))
        {
            throw new ArgumentException($"Unknown account token purpose '{purpose}'.", nameof(purpose));
        }

        bool isEmailChange = purpose == AccountTokenPurposes.EmailChange;

        if (isEmailChange == string.IsNullOrWhiteSpace(newEmail))
        {
            throw new ArgumentException(
                "An email change token needs the new address, and no other token takes one.",
                nameof(newEmail));
        }

        NewEmail = isEmailChange ? Account.NormalizeEmail(newEmail) : null;

        Id = Guid.CreateVersion7();
        AccountId = accountId;
        Purpose = purpose;
        TokenHash = Guard.Required(tokenHash, nameof(tokenHash), 64);
        CreatedAt = now;
        ExpiresAt = now + lifetime;
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public string Purpose { get; private set; } = string.Empty;

    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>For an email change, the address the token was sent to and will move to.</summary>
    public string? NewEmail { get; private set; }

    /// <summary>When the token was used, or replaced by a newer one.</summary>
    public DateTimeOffset? ConsumedAt { get; private set; }

    public bool IsUsableFor(string purpose, DateTimeOffset now) =>
        ConsumedAt is null
        && now < ExpiresAt
        && string.Equals(Purpose, purpose, StringComparison.Ordinal);

    public void Consume(DateTimeOffset now)
    {
        ConsumedAt ??= now;
    }
}

public static class AccountTokenPurposes
{
    public const string EmailVerification = "email_verification";
    public const string PasswordReset = "password_reset";
    public const string EmailChange = "email_change";

    /// <summary>
    /// Held by the browser between a correct password and the second sign-in step. Never sent by
    /// email.
    /// </summary>
    public const string TwoFactorSignIn = "two_factor_sign_in";

    public static bool IsKnown(string? purpose) =>
        purpose is EmailVerification or PasswordReset or EmailChange or TwoFactorSignIn;
}
