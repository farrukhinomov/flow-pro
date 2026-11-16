using FlowPro.Application.Accounts;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class AccountSessionRepository(FlowProDbContext dbContext)
    : IAccountSessionRepository,
        IAccountSecurityLog,
        IAccountTokenRepository,
        IAccountMemberships,
        IAccountWorkspaces
{
    public void Add(AccountSession session) => dbContext.AccountSessions.Add(session);

    public Task<AccountSession?> FindByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken) =>
        dbContext.AccountSessions.FirstOrDefaultAsync(
            session => session.TokenHash == tokenHash,
            cancellationToken);

    public Task<Account?> FindAccountAsync(Guid accountId, CancellationToken cancellationToken) =>
        dbContext.Accounts
            .AsNoTracking()
            .FirstOrDefaultAsync(account => account.Id == accountId, cancellationToken);

    public Task<int> RevokeAllAsync(
        Guid accountId,
        Guid? exceptSessionId,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        dbContext.AccountSessions
            .Where(session => session.AccountId == accountId
                && session.RevokedAt == null
                && session.ExpiresAt > now
                && session.Id != exceptSessionId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(session => session.RevokedAt, now),
                cancellationToken);

    public async Task<IReadOnlyList<AccountSession>> ListActiveAsync(
        Guid accountId,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        await dbContext.AccountSessions
            .AsNoTracking()
            .Where(session => session.AccountId == accountId
                && session.RevokedAt == null
                && session.ExpiresAt > now)
            .OrderByDescending(session => session.LastSeenAt)
            .ToArrayAsync(cancellationToken);

    public Task<AccountSession?> FindByIdAsync(Guid sessionId, CancellationToken cancellationToken) =>
        dbContext.AccountSessions.FirstOrDefaultAsync(
            session => session.Id == sessionId,
            cancellationToken);

    public void Record(AccountSecurityEvent securityEvent) =>
        dbContext.AccountSecurityEvents.Add(securityEvent);

    public void Add(AccountToken token) => dbContext.AccountTokens.Add(token);

    public Task<AccountToken?> FindByHashAsync(
        string tokenHash,
        CancellationToken cancellationToken) =>
        dbContext.AccountTokens.FirstOrDefaultAsync(
            token => token.TokenHash == tokenHash,
            cancellationToken);

    public Task ConsumeOutstandingAsync(
        Guid accountId,
        string? purpose,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        dbContext.AccountTokens
            .Where(token => token.AccountId == accountId
                && (purpose == null || token.Purpose == purpose)
                && token.ConsumedAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(token => token.ConsumedAt, now),
                cancellationToken);

    public async Task<int> MoveEmailAsync(
        Guid accountId,
        string oldEmail,
        string newEmail,
        CancellationToken cancellationToken)
    {
        // The account's memberships span workspaces, so they are loaded and saved across them.
        // Saved here, inside the caller's transaction, because other workspaces' rows are not
        // writable once the scope ends. Changed one by one rather than bulk-updated, so each
        // membership gets its version bump and timestamps like any other change.
        return await dbContext.AcrossTenantsAsync(
            async () =>
            {
                List<Membership> mirrors = await dbContext.Users
                    .Where(user => user.AccountId == accountId && user.Email == oldEmail)
                    .ToListAsync(cancellationToken);

                foreach (Membership user in mirrors)
                {
                    user.UpdateProfile(user.ExternalSubject, newEmail, user.DisplayName);
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                return mirrors.Count;
            },
            cancellationToken);
    }

    public async Task<IReadOnlyList<AccountWorkspace>> ListAsync(
        Guid accountId,
        CancellationToken cancellationToken) =>
        await dbContext.AcrossTenantsAsync(
            () => (
                from user in dbContext.Users.AsNoTracking()
                join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
                where user.AccountId == accountId
                    && user.Status == UserStatus.Active
                    && tenant.IsActive
                orderby tenant.Name, tenant.Id
                select new AccountWorkspace(tenant.Id, tenant.Name, user.CreatedAt)
            ).ToListAsync(cancellationToken),
            cancellationToken);

    public Task<Guid?> FindLastChosenAsync(Guid accountId, CancellationToken cancellationToken) =>
        dbContext.AccountSessions
            .AsNoTracking()
            .Where(session => session.AccountId == accountId && session.ActiveTenantId != null)
            .OrderByDescending(session => session.LastSeenAt)
            .Select(session => session.ActiveTenantId)
            .FirstOrDefaultAsync(cancellationToken);
}
