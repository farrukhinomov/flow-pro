using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

/// <summary>
/// Lets ASP.NET Core Identity's <see cref="UserManager{TUser}" /> read and write
/// <see cref="Account" /> rows.
/// </summary>
/// <remarks>
/// Identity owns the security-sensitive logic (password hashing, password rules, lockout); this
/// class only maps its storage contract onto the FlowPro schema. The email is the user name.
/// Changes are tracked on the shared <see cref="FlowProDbContext" /> and saved by the surrounding
/// unit of work, so an account change commits together with the session or event it belongs to.
/// </remarks>
internal sealed class AccountStore(FlowProDbContext dbContext) :
    IUserPasswordStore<Account>,
    IUserEmailStore<Account>,
    IUserLockoutStore<Account>,
    IUserSecurityStampStore<Account>
{
    public Task<IdentityResult> CreateAsync(Account user, CancellationToken cancellationToken)
    {
        dbContext.Accounts.Add(user);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<IdentityResult> UpdateAsync(Account user, CancellationToken cancellationToken)
    {
        // The account is already tracked; the unit of work saves it.
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<IdentityResult> DeleteAsync(Account user, CancellationToken cancellationToken)
    {
        dbContext.Accounts.Remove(user);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<Account?> FindByIdAsync(string userId, CancellationToken cancellationToken) =>
        Guid.TryParse(userId, out Guid id)
            ? dbContext.Accounts.FirstOrDefaultAsync(account => account.Id == id, cancellationToken)
            : Task.FromResult<Account?>(null);

    public Task<Account?> FindByNameAsync(string normalizedUserName, CancellationToken cancellationToken) =>
        FindByEmailAsync(normalizedUserName, cancellationToken);

    public Task<Account?> FindByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
    {
        // Identity normalizes to upper case; FlowPro stores emails lower-cased.
        string email = normalizedEmail.ToLowerInvariant();
        return dbContext.Accounts.FirstOrDefaultAsync(account => account.Email == email, cancellationToken);
    }

    public Task<string> GetUserIdAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.Id.ToString());

    public Task<string?> GetUserNameAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Email);

    public Task SetUserNameAsync(Account user, string? userName, CancellationToken cancellationToken)
    {
        // The user name is the email, which is set when the account is created.
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedUserNameAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Email.ToUpperInvariant());

    public Task SetNormalizedUserNameAsync(Account user, string? normalizedName, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task SetEmailAsync(Account user, string? email, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(email)
            && !string.Equals(Account.NormalizeEmail(email), user.Email, StringComparison.Ordinal))
        {
            user.ChangeEmail(email);
        }

        return Task.CompletedTask;
    }

    public Task<string?> GetEmailAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Email);

    public Task<bool> GetEmailConfirmedAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.EmailConfirmed);

    public Task SetEmailConfirmedAsync(Account user, bool confirmed, CancellationToken cancellationToken)
    {
        user.SetEmailConfirmed(confirmed);
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedEmailAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Email.ToUpperInvariant());

    public Task SetNormalizedEmailAsync(Account user, string? normalizedEmail, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task SetPasswordHashAsync(Account user, string? passwordHash, CancellationToken cancellationToken)
    {
        user.SetPasswordHash(passwordHash);
        return Task.CompletedTask;
    }

    public Task<string?> GetPasswordHashAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.PasswordHash);

    public Task<bool> HasPasswordAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.PasswordHash is not null);

    public Task<DateTimeOffset?> GetLockoutEndDateAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.LockoutEnd);

    public Task SetLockoutEndDateAsync(Account user, DateTimeOffset? lockoutEnd, CancellationToken cancellationToken)
    {
        user.SetLockoutEnd(lockoutEnd);
        return Task.CompletedTask;
    }

    public Task<int> IncrementAccessFailedCountAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.IncrementAccessFailedCount());

    public Task ResetAccessFailedCountAsync(Account user, CancellationToken cancellationToken)
    {
        user.ResetAccessFailedCount();
        return Task.CompletedTask;
    }

    public Task<int> GetAccessFailedCountAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(user.AccessFailedCount);

    public Task<bool> GetLockoutEnabledAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult(true);

    public Task SetLockoutEnabledAsync(Account user, bool enabled, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task SetSecurityStampAsync(Account user, string stamp, CancellationToken cancellationToken)
    {
        user.SetSecurityStamp(stamp);
        return Task.CompletedTask;
    }

    public Task<string?> GetSecurityStampAsync(Account user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.SecurityStamp);

    public void Dispose()
    {
        // The DbContext is owned by the dependency injection scope.
    }
}
