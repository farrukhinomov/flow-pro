using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

internal sealed class FakeCredentials : IAccountCredentials
{
    // Keyed by account, and searched by each account's current address, so an email change is
    // seen the way the real store sees it.
    private readonly Dictionary<Guid, (Account Account, string Password)> accounts = [];

    public HashSet<string> LockedOut { get; } = [];

    public bool NextFailureCausesLockout { get; set; }

    /// <summary>Failed attempts that lock an account, like the real Identity setting.</summary>
    public int MaxFailedAttempts { get; set; } = 5;

    public Account Seed(string email, string password, string displayName = "Ada", Guid? id = null)
    {
        Account account = new(email, displayName, id);
        accounts[account.Id] = (account, password);
        return account;
    }

    public Account? Find(Guid accountId) =>
        accounts.TryGetValue(accountId, out (Account Account, string Password) entry) ? entry.Account : null;

    public string? PasswordOf(string email) => Lookup(email)?.Password;

    public Task<AccountRegistration> RegisterAsync(
        string email,
        string displayName,
        string password,
        CancellationToken cancellationToken)
    {
        if (Lookup(email) is not null)
        {
            return Task.FromResult(AccountRegistration.Rejected(
                AccountRegistrationOutcome.EmailAlreadyRegistered,
                []));
        }

        if (password.Length < 12)
        {
            return Task.FromResult(AccountRegistration.Rejected(
                AccountRegistrationOutcome.PasswordRejected,
                ["Passwords must be at least 12 characters."]));
        }

        return Task.FromResult(AccountRegistration.Created(Seed(email, password, displayName)));
    }

    public Task<PasswordCheck> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        if (Lookup(email) is not { } entry)
        {
            return Task.FromResult(new PasswordCheck(PasswordCheckOutcome.Failed, null));
        }

        if (LockedOut.Contains(entry.Account.Email))
        {
            return Task.FromResult(new PasswordCheck(PasswordCheckOutcome.LockedOut, entry.Account));
        }

        if (entry.Password == password)
        {
            return Task.FromResult(new PasswordCheck(PasswordCheckOutcome.Succeeded, entry.Account));
        }

        return Task.FromResult(new PasswordCheck(
            PasswordCheckOutcome.Failed,
            entry.Account,
            CountFailure(entry.Account)));
    }

    public Task<bool> RecordFailedAttemptAsync(Account account, CancellationToken cancellationToken) =>
        Task.FromResult(CountFailure(account));

    public Task ResetFailedAttemptsAsync(Account account, CancellationToken cancellationToken)
    {
        account.ResetAccessFailedCount();
        return Task.CompletedTask;
    }

    public Task<Account?> FindByEmailAsync(string email, CancellationToken cancellationToken) =>
        Task.FromResult(Lookup(email)?.Account);

    public Task<Account?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult(Find(accountId));

    public Task<IReadOnlyList<string>> ResetPasswordAsync(
        Account account,
        string newPassword,
        CancellationToken cancellationToken)
    {
        if (newPassword.Length < 12)
        {
            return Task.FromResult<IReadOnlyList<string>>(["Passwords must be at least 12 characters."]);
        }

        accounts[account.Id] = (account, newPassword);
        LockedOut.Remove(account.Email);
        account.ResetAccessFailedCount();
        account.SetLockoutEnd(null);
        return Task.FromResult<IReadOnlyList<string>>([]);
    }

    private bool CountFailure(Account account)
    {
        if (account.IncrementAccessFailedCount() < MaxFailedAttempts && !NextFailureCausesLockout)
        {
            return false;
        }

        LockedOut.Add(account.Email);
        account.SetLockoutEnd(DateTimeOffset.MaxValue);
        return true;
    }

    private (Account Account, string Password)? Lookup(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        string normalized = email.Trim().ToLowerInvariant();

        foreach ((Account Account, string Password) entry in accounts.Values)
        {
            if (entry.Account.Email == normalized)
            {
                return entry;
            }
        }

        return null;
    }
}

internal sealed class FakeSessionStore(FakeCredentials credentials)
    : IAccountSessionRepository, IAccountSecurityLog, IAccountTokenRepository, IAccountMemberships, IAccountWorkspaces
{
    public List<AccountSession> Sessions { get; } = [];

    public List<AccountSecurityEvent> Events { get; } = [];

    public List<AccountToken> Tokens { get; } = [];

    public void Add(AccountSession session) => Sessions.Add(session);

    public Task<AccountSession?> FindByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken) =>
        Task.FromResult(Sessions.FirstOrDefault(session => session.TokenHash == tokenHash));

    public Task<Account?> FindAccountAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult(credentials.Find(accountId));

    public Task<int> RevokeAllAsync(
        Guid accountId,
        Guid? exceptSessionId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        AccountSession[] active = [.. Sessions.Where(session =>
            session.AccountId == accountId
            && session.Id != exceptSessionId
            && session.RevokedAt is null
            && session.ExpiresAt > now)];

        foreach (AccountSession session in active)
        {
            session.Revoke(now);
        }

        return Task.FromResult(active.Length);
    }

    public Task<IReadOnlyList<AccountSession>> ListActiveAsync(
        Guid accountId,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccountSession>>(
        [
            .. Sessions
                .Where(session => session.AccountId == accountId
                    && session.RevokedAt is null
                    && session.ExpiresAt > now)
                .OrderByDescending(session => session.LastSeenAt),
        ]);

    public Task<AccountSession?> FindByIdAsync(Guid sessionId, CancellationToken cancellationToken) =>
        Task.FromResult(Sessions.FirstOrDefault(session => session.Id == sessionId));

    public void Record(AccountSecurityEvent securityEvent) => Events.Add(securityEvent);

    public void Add(AccountToken token) => Tokens.Add(token);

    public Task<AccountToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken) =>
        Task.FromResult(Tokens.FirstOrDefault(token => token.TokenHash == tokenHash));

    public Task ConsumeOutstandingAsync(
        Guid accountId,
        string? purpose,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (AccountToken token in Tokens.Where(token =>
                     token.AccountId == accountId && (purpose is null || token.Purpose == purpose)))
        {
            token.Consume(now);
        }

        return Task.CompletedTask;
    }

    /// <summary>Active workspaces per account.</summary>
    public Dictionary<Guid, List<AccountWorkspace>> Workspaces { get; } = [];

    public Task<IReadOnlyList<AccountWorkspace>> ListAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccountWorkspace>>(
            Workspaces.TryGetValue(accountId, out List<AccountWorkspace>? list)
                ? [.. list.OrderBy(workspace => workspace.Name, StringComparer.Ordinal)]
                : []);

    public Task<Guid?> FindLastChosenAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult(
            Sessions
                .Where(session => session.AccountId == accountId && session.ActiveTenantId != null)
                .OrderByDescending(session => session.LastSeenAt)
                .Select(session => session.ActiveTenantId)
                .FirstOrDefault());

    /// <summary>Email moves the handler asked for, as (account, old, new).</summary>
    public List<(Guid AccountId, string OldEmail, string NewEmail)> MembershipMoves { get; } = [];

    public Task<int> MoveEmailAsync(
        Guid accountId,
        string oldEmail,
        string newEmail,
        CancellationToken cancellationToken)
    {
        MembershipMoves.Add((accountId, oldEmail, newEmail));
        return Task.FromResult(1);
    }
}

internal sealed class FakeEmailQueue : IEmailQueue
{
    public List<EmailMessage> Sent { get; } = [];

    public void Enqueue(EmailMessage message) => Sent.Add(message);

    /// <summary>The token from the link in the most recent message.</summary>
    public string LastToken()
    {
        string body = Sent[^1].TextBody;
        int start = body.IndexOf(AccountMailbox.TokenFragmentPrefix, StringComparison.Ordinal)
            + AccountMailbox.TokenFragmentPrefix.Length;

        return body.Substring(start, 43);
    }
}

/// <summary>Runs the operation directly; a throwing operation leaves fakes as they were changed.</summary>
internal sealed class PassThroughUnitOfWork : IUnitOfWork
{
    public Task<TResult> ExecuteAsync<TResult>(
        Func<CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken) =>
        operation(cancellationToken);
}

internal sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
{
    private DateTimeOffset current = now;

    public override DateTimeOffset GetUtcNow() => current;

    public void Advance(TimeSpan duration) => current += duration;
}

internal sealed class FakeInvitationStore : IMembershipInvitationRepository, IInvitationTargets
{
    public List<MembershipInvitation> Invitations { get; } = [];

    public Dictionary<Guid, string> WorkspaceNames { get; } = [];

    public List<Membership> Memberships { get; } = [];

    public void Add(MembershipInvitation invitation) => Invitations.Add(invitation);

    public Task<MembershipInvitation?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken) =>
        Task.FromResult(Invitations.FirstOrDefault(invitation => invitation.TokenHash == tokenHash));

    public Task RevokeOutstandingAsync(
        Guid tenantId,
        Guid userId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (MembershipInvitation invitation in Invitations.Where(invitation =>
                     invitation.TenantId == tenantId && invitation.UserId == userId))
        {
            invitation.Revoke(now);
        }

        return Task.CompletedTask;
    }

    public Task<InvitationTarget?> FindAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken)
    {
        Membership? membership = Memberships.FirstOrDefault(user => user.TenantId == tenantId && user.Id == userId);

        return Task.FromResult(
            membership is not null && WorkspaceNames.TryGetValue(tenantId, out string? name)
                ? new InvitationTarget(membership, name)
                : null);
    }

    public Task<string?> FindWorkspaceNameAsync(Guid tenantId, CancellationToken cancellationToken) =>
        Task.FromResult(WorkspaceNames.TryGetValue(tenantId, out string? name) ? name : null);
}

/// <summary>Runs the operation directly, ignoring the tenant scope.</summary>
internal sealed class PassThroughProvisioningUnitOfWork : IProvisioningUnitOfWork
{
    public List<Guid> Scopes { get; } = [];

    public Task<TResult> ExecuteInTenantScopeAsync<TResult>(
        Guid tenantId,
        Func<CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken)
    {
        Scopes.Add(tenantId);
        return operation(cancellationToken);
    }
}


internal sealed class FakeRecoveryCodes : IAccountRecoveryCodeRepository
{
    public List<AccountRecoveryCode> Codes { get; } = [];

    public void Add(AccountRecoveryCode code) => Codes.Add(code);

    public Task<IReadOnlyList<AccountRecoveryCode>> ListUnusedAsync(
        Guid accountId,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccountRecoveryCode>>(
            [.. Codes.Where(code => code.AccountId == accountId && !code.IsUsed)]);

    public Task RemoveAllAsync(Guid accountId, CancellationToken cancellationToken)
    {
        Codes.RemoveAll(code => code.AccountId == accountId);
        return Task.CompletedTask;
    }
}

/// <summary>Marks keys as protected without encrypting them, so tests can see they went through it.</summary>
internal sealed class FakeKeyProtector : IAuthenticatorKeyProtector
{
    private const string Prefix = "protected:";

    public string Protect(byte[] key) => Prefix + Convert.ToBase64String(key);

    public byte[] Unprotect(string protectedKey) =>
        protectedKey.StartsWith(Prefix, StringComparison.Ordinal)
            ? Convert.FromBase64String(protectedKey[Prefix.Length..])
            : throw new InvalidOperationException("The key was not protected.");
}

internal static class TestSharedAccounts
{
    /// <summary>An instance without the demo: no account is shared.</summary>
    public static SharedAccountPolicy None { get; } = new(new DemoOptions());

    /// <summary>The public demo, where the demo logins are shared.</summary>
    public static SharedAccountPolicy Demo { get; } =
        new(new DemoOptions { Enabled = true, Password = "a public demo password" });
}
