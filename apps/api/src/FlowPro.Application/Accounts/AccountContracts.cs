using FlowPro.Application.Common;

namespace FlowPro.Application.Accounts;

/// <summary>Where a request came from, recorded with sessions and security events.</summary>
public sealed record ClientContext(string? IpAddress, string? UserAgent);

public sealed record RegisterAccountCommand(
    string Email,
    string Password,
    string DisplayName,
    ClientContext Client) : ICommand<IssuedSession>;

public sealed record SignInCommand(
    string Email,
    string Password,
    ClientContext Client) : ICommand<SignInOutcome>;

/// <summary>
/// Either a session, or, for an account with two-step sign-in, a challenge to answer with a code
/// before a session is issued.
/// </summary>
public sealed record SignInOutcome(IssuedSession? Session, IssuedChallenge? Challenge)
{
    public static SignInOutcome SignedIn(IssuedSession session) => new(session, null);

    public static SignInOutcome CodeRequired(IssuedChallenge challenge) => new(null, challenge);
}

/// <summary>
/// Proof that the password was right, handed to the browser as an HttpOnly cookie and answered
/// with a code. Like a session token, only its hash is stored.
/// </summary>
public sealed record IssuedChallenge(string Token, DateTimeOffset ExpiresAt);

public sealed record SignOutCommand(string? SessionToken, ClientContext Client) : ICommand<SignedOut>;

public sealed record ResolveSessionQuery(string? SessionToken) : IQuery<ResolvedSession?>;

/// <summary>
/// A freshly created session. <see cref="Token" /> is the only time the raw token exists outside
/// the browser; the caller hands it to the browser as a cookie and never stores it.
/// </summary>
public sealed record IssuedSession(
    string Token,
    DateTimeOffset ExpiresAt,
    Guid AccountId,
    string Email,
    string DisplayName);

public sealed record SignedOut(bool SessionEnded);

/// <summary>The account behind a valid session token.</summary>
public sealed record ResolvedSession(
    Guid SessionId,
    Guid AccountId,
    string Email,
    string DisplayName,
    Guid? ActiveTenantId);

/// <summary>How long sessions live. Bound from configuration by the host.</summary>
public sealed class AccountSessionOptions
{
    public const string SectionName = "Authentication:Session";

    /// <summary>
    /// Whether anyone may create an account. Turned off for the public demo and for instances
    /// where people only join by invitation.
    /// </summary>
    public bool RegistrationEnabled { get; init; } = true;

    /// <summary>A session ends this long after sign-in, however active it is.</summary>
    public TimeSpan AbsoluteLifetime { get; init; } = TimeSpan.FromDays(30);

    /// <summary>A session ends after this long without a request.</summary>
    public TimeSpan IdleTimeout { get; init; } = TimeSpan.FromDays(7);

    /// <summary>Activity is written at most this often per session.</summary>
    public TimeSpan ActivityWriteInterval { get; init; } = TimeSpan.FromMinutes(5);
}
