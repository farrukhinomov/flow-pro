using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Creates accounts and checks passwords. Implemented on top of ASP.NET Core Identity, which owns
/// password hashing, password rules and lockout.
/// </summary>
public interface IAccountCredentials
{
    Task<AccountRegistration> RegisterAsync(
        string email,
        string displayName,
        string password,
        CancellationToken cancellationToken);

    /// <summary>
    /// Checks the password. A wrong one counts towards lockout; a correct one leaves the count
    /// alone, because with two-step sign-in the attempt is not over yet. The caller resets it with
    /// <see cref="ResetFailedAttemptsAsync" /> once the person is fully signed in.
    /// </summary>
    Task<PasswordCheck> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken);

    /// <summary>Counts a failed attempt, such as a wrong sign-in code, towards lockout.</summary>
    /// <returns>True when this attempt locked the account.</returns>
    Task<bool> RecordFailedAttemptAsync(Account account, CancellationToken cancellationToken);

    Task ResetFailedAttemptsAsync(Account account, CancellationToken cancellationToken);

    /// <summary>Finds an account for changing it. Returns null for an unknown or blank email.</summary>
    Task<Account?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>Finds an account for changing it.</summary>
    Task<Account?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken);

    /// <summary>
    /// Replaces the password after checking it against the password rules. On success the
    /// security stamp changes and any lockout is lifted.
    /// </summary>
    /// <returns>Why the password was rejected; empty when it was set.</returns>
    Task<IReadOnlyList<string>> ResetPasswordAsync(
        Account account,
        string newPassword,
        CancellationToken cancellationToken);
}

public interface IAccountTokenRepository
{
    void Add(AccountToken token);

    Task<AccountToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>
    /// Marks the account's unused tokens for <paramref name="purpose" /> as consumed, so only the
    /// newest link sent works. Without a purpose, every unused token of the account is consumed.
    /// </summary>
    Task ConsumeOutstandingAsync(
        Guid accountId,
        string? purpose,
        DateTimeOffset now,
        CancellationToken cancellationToken);
}

/// <summary>The workspaces an account belongs to.</summary>
public interface IAccountWorkspaces
{
    /// <summary>Active memberships in active workspaces, ordered by workspace name.</summary>
    Task<IReadOnlyList<AccountWorkspace>> ListAsync(Guid accountId, CancellationToken cancellationToken);

    /// <summary>The workspace the account's most recently used session acted in, if any.</summary>
    Task<Guid?> FindLastChosenAsync(Guid accountId, CancellationToken cancellationToken);
}

/// <summary>The account's workspace memberships, which keep a copy of its email address.</summary>
public interface IAccountMemberships
{
    /// <summary>
    /// Moves the account's memberships that still show <paramref name="oldEmail" /> to
    /// <paramref name="newEmail" />. A membership whose address an administrator set to something
    /// else keeps it.
    /// </summary>
    /// <returns>How many memberships changed.</returns>
    Task<int> MoveEmailAsync(
        Guid accountId,
        string oldEmail,
        string newEmail,
        CancellationToken cancellationToken);
}

/// <summary>
/// Hands email to a background sender. Queuing instead of sending inline keeps response times
/// independent of whether an email went out, so they do not reveal which addresses have accounts.
/// </summary>
public interface IEmailQueue
{
    void Enqueue(EmailMessage message);
}

public sealed record EmailMessage(string To, string Subject, string TextBody);

public enum AccountRegistrationOutcome
{
    Created,
    EmailAlreadyRegistered,
    PasswordRejected,
    EmailRejected,
}

/// <param name="Problems">Human-readable reasons when the outcome is a rejection.</param>
public sealed record AccountRegistration(
    AccountRegistrationOutcome Outcome,
    Account? Account,
    IReadOnlyList<string> Problems)
{
    public static AccountRegistration Created(Account account) =>
        new(AccountRegistrationOutcome.Created, account, []);

    public static AccountRegistration Rejected(
        AccountRegistrationOutcome outcome,
        IReadOnlyList<string> problems) =>
        new(outcome, null, problems);
}

public enum PasswordCheckOutcome
{
    Succeeded,
    Failed,
    LockedOut,
}

/// <param name="Account">
/// The matching account when one exists, also for a failed or locked-out attempt, so the attempt
/// can be recorded against it.
/// </param>
/// <param name="CausedLockout">True when this failed attempt is the one that locked the account.</param>
public sealed record PasswordCheck(
    PasswordCheckOutcome Outcome,
    Account? Account,
    bool CausedLockout = false);

public interface IAccountSessionRepository
{
    void Add(AccountSession session);

    Task<AccountSession?> FindByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);

    Task<Account?> FindAccountAsync(Guid accountId, CancellationToken cancellationToken);

    /// <summary>
    /// Ends every active session of the account except <paramref name="exceptSessionId" />, for
    /// example after a password reset (none kept) or change (the current one kept).
    /// </summary>
    Task<int> RevokeAllAsync(
        Guid accountId,
        Guid? exceptSessionId,
        DateTimeOffset now,
        CancellationToken cancellationToken);

    /// <summary>Sessions that are neither revoked nor past their absolute expiry, newest activity first.</summary>
    Task<IReadOnlyList<AccountSession>> ListActiveAsync(
        Guid accountId,
        DateTimeOffset now,
        CancellationToken cancellationToken);

    Task<AccountSession?> FindByIdAsync(Guid sessionId, CancellationToken cancellationToken);
}

public interface IAccountSecurityLog
{
    void Record(AccountSecurityEvent securityEvent);
}

/// <summary>
/// Encrypts authenticator secrets before they are stored, so a copy of the database alone does not
/// let anyone produce sign-in codes.
/// </summary>
public interface IAuthenticatorKeyProtector
{
    string Protect(byte[] key);

    byte[] Unprotect(string protectedKey);
}

public interface IAccountRecoveryCodeRepository
{
    void Add(AccountRecoveryCode code);

    Task<IReadOnlyList<AccountRecoveryCode>> ListUnusedAsync(Guid accountId, CancellationToken cancellationToken);

    /// <summary>Deletes every code of the account, used or not.</summary>
    Task RemoveAllAsync(Guid accountId, CancellationToken cancellationToken);
}
