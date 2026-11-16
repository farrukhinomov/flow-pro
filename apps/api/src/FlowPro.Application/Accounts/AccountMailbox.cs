using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Issues the single-use tokens that account emails carry and writes those emails.
/// </summary>
/// <remarks>
/// <see cref="PrepareAsync" /> runs inside the caller's transaction and only stores the token.
/// The caller enqueues the returned message with <see cref="Send" /> after the transaction has
/// committed, so a link is never sent for a token that was rolled back.
/// </remarks>
public sealed class AccountMailbox(
    IAccountTokenRepository tokens,
    IEmailQueue queue,
    AccountEmailOptions options,
    TimeProvider timeProvider)
{
    /// <summary>
    /// The secret goes in the URL fragment, which browsers send neither to the server nor in the
    /// <c>Referer</c> header, so it stays out of access logs and third-party requests.
    /// </summary>
    public const string TokenFragmentPrefix = "#token=";

    public async Task<EmailMessage?> PrepareAsync(
        Account account,
        string purpose,
        CancellationToken cancellationToken)
    {
        if (options.AppBaseUrl is null)
        {
            // Without a base URL there is no link to send. Startup refuses this configuration
            // outside Development, so it only happens on a developer's machine.
            return null;
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        await tokens.ConsumeOutstandingAsync(account.Id, purpose, now, cancellationToken);

        string token = SessionToken.Generate();
        tokens.Add(new AccountToken(
            account.Id,
            purpose,
            SessionToken.Hash(token),
            now,
            purpose == AccountTokenPurposes.PasswordReset
                ? options.PasswordResetLifetime
                : options.EmailVerificationLifetime));

        return purpose == AccountTokenPurposes.PasswordReset
            ? PasswordResetMessage(account, BuildLink("reset-password", token))
            : VerificationMessage(account, BuildLink("verify-email", token));
    }

    /// <summary>
    /// Stores a token for moving <paramref name="account" /> to <paramref name="newEmail" /> and
    /// returns the confirmation email, addressed to the new address.
    /// </summary>
    public async Task<EmailMessage?> PrepareEmailChangeAsync(
        Account account,
        string newEmail,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(account);

        if (options.AppBaseUrl is null)
        {
            return null;
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        await tokens.ConsumeOutstandingAsync(
            account.Id,
            AccountTokenPurposes.EmailChange,
            now,
            cancellationToken);

        string token = SessionToken.Generate();
        AccountToken stored = new(
            account.Id,
            AccountTokenPurposes.EmailChange,
            SessionToken.Hash(token),
            now,
            options.EmailChangeLifetime,
            newEmail);
        tokens.Add(stored);

        return new EmailMessage(
            stored.NewEmail!,
            "Confirm your new FlowPro email address",
            $"""
            Hello {account.DisplayName},

            you asked to sign in to FlowPro with this email address from now on. To confirm it,
            open this link:

            {BuildLink("confirm-email-change", token)}

            The link works once and expires in {Describe(options.EmailChangeLifetime)}. Until
            then you keep signing in with your current address.
            If you did not ask for this, ignore this email; nothing changes.
            """);
    }

    /// <summary>
    /// Sent instead of a confirmation link when the new address already belongs to another
    /// account, so the request itself answers the same way and does not reveal who has one.
    /// </summary>
    public static EmailMessage EmailInUseNotice(string newEmail) =>
        new(
            Account.NormalizeEmail(newEmail),
            "Your email address is already used for FlowPro",
            """
            Hello,

            someone asked to move a FlowPro account to this email address, but it already belongs
            to another FlowPro account, so nothing changed.

            If that was you, sign in with this address instead. If it was not, you can ignore this
            email.
            """);

    /// <summary>
    /// Tells the previous address that the account moved, so a change made with a stolen session
    /// does not go unnoticed. Carries no link or secret.
    /// </summary>
    public static EmailMessage EmailChangedNotice(Account account, string oldEmail)
    {
        ArgumentNullException.ThrowIfNull(account);

        return new EmailMessage(
            oldEmail,
            "Your FlowPro email address was changed",
            $"""
            Hello {account.DisplayName},

            your FlowPro account now signs in with {account.Email} instead of this address.

            If this was you, there is nothing to do. If it was not, tell your administrator right
            away: someone else may control your account.
            """);
    }

    /// <summary>
    /// Tells the owner their password changed, so someone who changed it with a stolen session
    /// does not go unnoticed. Carries no link or secret.
    /// </summary>
    public static EmailMessage PasswordChangedNotice(Account account)
    {
        ArgumentNullException.ThrowIfNull(account);

        return new EmailMessage(
            account.Email,
            "Your FlowPro password was changed",
            $"""
            Hello {account.DisplayName},

            the password of your FlowPro account was just changed, and every other signed-in
            device was signed out.

            If this was you, there is nothing to do. If it was not, use "Forgot password?" on the
            sign-in page right away to choose a new password, and tell your administrator.
            """);
    }

    public static EmailMessage TwoFactorEnabledNotice(Account account) =>
        SecurityNotice(
            account,
            "Two-step sign-in is on for your FlowPro account",
            """
            signing in to your FlowPro account now also needs a code from your authenticator app,
            and every other signed-in device was signed out.

            Keep your recovery codes somewhere safe: they are the way in if you lose your phone.
            """);

    public static EmailMessage TwoFactorDisabledNotice(Account account) =>
        SecurityNotice(
            account,
            "Two-step sign-in is off for your FlowPro account",
            """
            signing in to your FlowPro account no longer needs a code from your authenticator app,
            and your recovery codes stopped working.
            """);

    public static EmailMessage RecoveryCodesRegeneratedNotice(Account account) =>
        SecurityNotice(
            account,
            "New FlowPro recovery codes were created",
            """
            new recovery codes were created for your FlowPro account, and the previous ones stopped
            working.
            """);

    public static EmailMessage RecoveryCodeUsedNotice(Account account, int codesLeft) =>
        SecurityNotice(
            account,
            "A FlowPro recovery code was used to sign in",
            $"""
            someone signed in to your FlowPro account with a recovery code instead of a code from
            your authenticator app. {Plural(codesLeft, "recovery code")} left.

            If you lost your phone, create new recovery codes on the Security page and set up the
            authenticator app again.
            """);

    public void Send(EmailMessage? message)
    {
        if (message is not null)
        {
            queue.Enqueue(message);
        }
    }

    private string BuildLink(string path, string token)
    {
        string baseUrl = options.AppBaseUrl!.AbsoluteUri;
        string separator = baseUrl.EndsWith('/') ? string.Empty : "/";

        return $"{baseUrl}{separator}{path}{TokenFragmentPrefix}{token}";
    }

    private EmailMessage VerificationMessage(Account account, string link) =>
        new(
            account.Email,
            "Confirm your FlowPro email address",
            $"""
            Hello {account.DisplayName},

            please confirm that this is your email address by opening this link:

            {link}

            The link works once and expires in {Describe(options.EmailVerificationLifetime)}.
            If you did not create a FlowPro account, you can ignore this email.
            """);

    private EmailMessage PasswordResetMessage(Account account, string link) =>
        new(
            account.Email,
            "Reset your FlowPro password",
            $"""
            Hello {account.DisplayName},

            someone asked to reset the password of your FlowPro account. To choose a new password,
            open this link:

            {link}

            The link works once and expires in {Describe(options.PasswordResetLifetime)}.
            Resetting the password signs you out everywhere.
            If you did not ask for this, ignore this email; your password stays unchanged.
            """);

    /// <summary>
    /// Tells the owner about a change to how they sign in, so one made with a stolen session does
    /// not go unnoticed. Carries no link or secret.
    /// </summary>
    private static EmailMessage SecurityNotice(Account account, string subject, string what)
    {
        ArgumentNullException.ThrowIfNull(account);

        return new EmailMessage(
            account.Email,
            subject,
            $"""
            Hello {account.DisplayName},

            {what}

            If this was you, there is nothing to do. If it was not, change your password right away
            and tell your administrator.
            """);
    }

    private static string Describe(TimeSpan lifetime) =>
        lifetime.TotalHours >= 24 && lifetime.TotalHours % 24 == 0
            ? Plural((int)lifetime.TotalDays, "day")
            : lifetime.TotalMinutes >= 60 && lifetime.TotalMinutes % 60 == 0
                ? Plural((int)lifetime.TotalHours, "hour")
                : Plural((int)Math.Ceiling(lifetime.TotalMinutes), "minute");

    private static string Plural(int count, string unit) =>
        count == 1 ? $"1 {unit}" : $"{count} {unit}s";
}
