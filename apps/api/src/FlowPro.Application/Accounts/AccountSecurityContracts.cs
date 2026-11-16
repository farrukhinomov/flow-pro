using FlowPro.Application.Common;

namespace FlowPro.Application.Accounts;

/// <summary>The signed-in account and the session making the request.</summary>
public sealed record AccountCaller(Guid AccountId, Guid SessionId);

public sealed record GetAccountOverviewQuery(AccountCaller Caller) : IQuery<AccountOverview>;

public sealed record AccountOverview(
    Guid AccountId,
    string Email,
    string DisplayName,
    bool EmailConfirmed,
    IReadOnlyList<AccountSessionSummary> Sessions,
    bool TwoFactorEnabled,
    int RecoveryCodesLeft,
    bool IsSharedDemoLogin);

/// <param name="IsCurrent">True for the session that made this request.</param>
public sealed record AccountSessionSummary(
    Guid SessionId,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastSeenAt,
    DateTimeOffset ExpiresAt,
    string? UserAgent,
    string? IpAddress,
    bool IsCurrent);

public sealed record ChangePasswordCommand(
    AccountCaller Caller,
    string CurrentPassword,
    string NewPassword,
    ClientContext Client) : ICommand<PasswordChanged>;

/// <param name="OtherSessionsEnded">How many other signed-in sessions the change ended.</param>
public sealed record PasswordChanged(int OtherSessionsEnded);

/// <summary>
/// Sends a confirmation link to <paramref name="NewEmail" />. The account keeps its address until
/// the link is opened.
/// </summary>
public sealed record ChangeEmailCommand(
    AccountCaller Caller,
    string CurrentPassword,
    string NewEmail,
    ClientContext Client) : ICommand<EmailRequestAccepted>;

public sealed record RevokeSessionCommand(AccountCaller Caller, Guid SessionId, ClientContext Client)
    : ICommand<SessionsRevoked>;

public sealed record RevokeOtherSessionsCommand(AccountCaller Caller, ClientContext Client)
    : ICommand<SessionsRevoked>;

public sealed record SessionsRevoked(int Count);
