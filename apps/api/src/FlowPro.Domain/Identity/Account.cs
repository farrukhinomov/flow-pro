using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// A person's single sign-in identity across the whole FlowPro instance.
/// </summary>
/// <remarks>
/// An account holds credentials and nothing tenant-specific. What the person may do inside a
/// tenant is decided by their membership there (<see cref="Membership" />), which refers to
/// the account by its identifier.
/// </remarks>
public sealed class Account : ITrackedEntity
{
    private Account()
    {
    }

    public Account(string email, string displayName, Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        Email = NormalizeEmail(email);
        DisplayName = Guard.Required(displayName, nameof(displayName), 200);
        SecurityStamp = Guid.NewGuid().ToString("N");
        Version = 1;
    }

    public Guid Id { get; private set; }

    /// <summary>Lower-cased and unique across the instance.</summary>
    public string Email { get; private set; } = string.Empty;

    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>Null until a password has been set.</summary>
    public string? PasswordHash { get; private set; }

    /// <summary>Changes whenever credentials change, so older sessions can be told apart.</summary>
    public string SecurityStamp { get; private set; } = string.Empty;

    public bool EmailConfirmed { get; private set; }

    public int AccessFailedCount { get; private set; }

    /// <summary>The account cannot sign in before this instant.</summary>
    public DateTimeOffset? LockoutEnd { get; private set; }

    /// <summary>Whether signing in also needs a code from an authenticator app or a recovery code.</summary>
    public bool TwoFactorEnabled { get; private set; }

    /// <summary>
    /// The authenticator app's shared secret, encrypted by the host. Set while two-step sign-in is
    /// being set up, and kept while it is on.
    /// </summary>
    public string? AuthenticatorKey { get; private set; }

    /// <summary>
    /// The 30-second time step of the last accepted authenticator code. A code is only accepted for
    /// a later step, so an observed code cannot be used again.
    /// </summary>
    public long? AuthenticatorTimeStep { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public static string NormalizeEmail(string? email) =>
        Guard.Required(email, nameof(email), 320).ToLowerInvariant();

    public bool IsLockedOut(DateTimeOffset now) => LockoutEnd is not null && LockoutEnd > now;

    public void ChangeEmail(string email)
    {
        Email = NormalizeEmail(email);
        Version++;
    }

    public void SetPasswordHash(string? passwordHash)
    {
        PasswordHash = passwordHash;
        Version++;
    }

    public void SetSecurityStamp(string securityStamp)
    {
        SecurityStamp = Guard.Required(securityStamp, nameof(securityStamp), 100);
        Version++;
    }

    public void SetEmailConfirmed(bool confirmed)
    {
        EmailConfirmed = confirmed;
        Version++;
    }

    public void SetLockoutEnd(DateTimeOffset? lockoutEnd)
    {
        LockoutEnd = lockoutEnd;
        Version++;
    }

    public int IncrementAccessFailedCount()
    {
        AccessFailedCount++;
        Version++;
        return AccessFailedCount;
    }

    /// <summary>Stores a new, not yet confirmed authenticator secret.</summary>
    public void BeginAuthenticatorSetup(string protectedKey)
    {
        if (TwoFactorEnabled)
        {
            throw new InvalidOperationException("Two-step sign-in is already on.");
        }

        AuthenticatorKey = Guard.Required(protectedKey, nameof(protectedKey), 1000);
        AuthenticatorTimeStep = null;
        Version++;
    }

    /// <summary>Turns two-step sign-in on after the app proved it has the secret.</summary>
    public void EnableTwoFactor(long confirmedTimeStep)
    {
        if (AuthenticatorKey is null)
        {
            throw new InvalidOperationException("Set up an authenticator before turning two-step sign-in on.");
        }

        TwoFactorEnabled = true;
        AuthenticatorTimeStep = confirmedTimeStep;
        Version++;
    }

    public void DisableTwoFactor()
    {
        TwoFactorEnabled = false;
        AuthenticatorKey = null;
        AuthenticatorTimeStep = null;
        Version++;
    }

    /// <summary>
    /// Accepts a code for <paramref name="timeStep" /> unless a code for that step or a later one
    /// was already accepted.
    /// </summary>
    public bool TryUseAuthenticatorTimeStep(long timeStep)
    {
        if (AuthenticatorTimeStep is { } last && timeStep <= last)
        {
            return false;
        }

        AuthenticatorTimeStep = timeStep;
        Version++;
        return true;
    }

    public void ResetAccessFailedCount()
    {
        if (AccessFailedCount == 0)
        {
            return;
        }

        AccessFailedCount = 0;
        Version++;
    }
}
