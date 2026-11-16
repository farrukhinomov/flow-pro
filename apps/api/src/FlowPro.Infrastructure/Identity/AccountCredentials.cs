using FlowPro.Application.Accounts;
using FlowPro.Domain.Identity;
using Microsoft.AspNetCore.Identity;

namespace FlowPro.Infrastructure.Identity;

/// <summary>
/// Account creation and password checks on top of <see cref="UserManager{TUser}" />.
/// </summary>
internal sealed class AccountCredentials(
    UserManager<Account> userManager,
    IPasswordHasher<Account> passwordHasher,
    SharedAccountPolicy sharedAccounts) : IAccountCredentials
{
    // Verified when no account matches the email, so an unknown email takes about as long to
    // reject as a wrong password and response time does not reveal which emails are registered.
    private static readonly Account TimingAccount = new("timing@flowpro.invalid", "Timing");
    private static string? timingHash;

    public async Task<AccountRegistration> RegisterAsync(
        string email,
        string displayName,
        string password,
        CancellationToken cancellationToken)
    {
        Account account;

        try
        {
            account = new Account(email, displayName);
        }
        catch (ArgumentException exception)
        {
            return AccountRegistration.Rejected(
                AccountRegistrationOutcome.EmailRejected,
                [exception.Message]);
        }

        IdentityResult result = await userManager.CreateAsync(account, password);

        if (result.Succeeded)
        {
            return AccountRegistration.Created(account);
        }

        string[] problems = [.. result.Errors.Select(error => error.Description)];

        if (result.Errors.Any(error => error.Code is "DuplicateEmail" or "DuplicateUserName"))
        {
            return AccountRegistration.Rejected(
                AccountRegistrationOutcome.EmailAlreadyRegistered,
                problems);
        }

        return AccountRegistration.Rejected(
            result.Errors.Any(error => error.Code.StartsWith("Password", StringComparison.Ordinal))
                ? AccountRegistrationOutcome.PasswordRejected
                : AccountRegistrationOutcome.EmailRejected,
            problems);
    }

    public async Task<PasswordCheck> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        Account? account = string.IsNullOrWhiteSpace(email)
            ? null
            : await userManager.FindByEmailAsync(email.Trim());

        if (account is null)
        {
            timingHash ??= passwordHasher.HashPassword(TimingAccount, Guid.NewGuid().ToString());
            passwordHasher.VerifyHashedPassword(TimingAccount, timingHash, password);
            return new PasswordCheck(PasswordCheckOutcome.Failed, null);
        }

        if (await userManager.IsLockedOutAsync(account))
        {
            return new PasswordCheck(PasswordCheckOutcome.LockedOut, account);
        }

        // A correct password leaves the failure count alone: the caller resets it once the
        // sign-in is complete, which for two-step sign-in is only after the code.
        if (await userManager.CheckPasswordAsync(account, password))
        {
            return new PasswordCheck(PasswordCheckOutcome.Succeeded, account);
        }

        return new PasswordCheck(
            PasswordCheckOutcome.Failed,
            account,
            await RecordFailedAttemptAsync(account, cancellationToken));
    }

    public async Task<bool> RecordFailedAttemptAsync(Account account, CancellationToken cancellationToken)
    {
        // A shared demo login's password is public, and locking it would lock out every visitor.
        // The per-address rate limit still applies.
        if (sharedAccounts.IsShared(account.Id))
        {
            return false;
        }

        await userManager.AccessFailedAsync(account);
        return await userManager.IsLockedOutAsync(account);
    }

    public Task ResetFailedAttemptsAsync(Account account, CancellationToken cancellationToken) =>
        userManager.ResetAccessFailedCountAsync(account);

    public Task<Account?> FindByEmailAsync(string email, CancellationToken cancellationToken) =>
        string.IsNullOrWhiteSpace(email)
            ? Task.FromResult<Account?>(null)
            : userManager.FindByEmailAsync(email.Trim());

    public Task<Account?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken) =>
        userManager.FindByIdAsync(accountId.ToString());

    public async Task<IReadOnlyList<string>> ResetPasswordAsync(
        Account account,
        string newPassword,
        CancellationToken cancellationToken)
    {
        // Validate before touching the account, so a rejected password leaves it unchanged.
        List<string> problems = [];

        foreach (IPasswordValidator<Account> validator in userManager.PasswordValidators)
        {
            IdentityResult result = await validator.ValidateAsync(userManager, account, newPassword);
            problems.AddRange(result.Errors.Select(error => error.Description));
        }

        if (problems.Count > 0)
        {
            return problems;
        }

        account.SetPasswordHash(passwordHasher.HashPassword(account, newPassword));
        await userManager.UpdateSecurityStampAsync(account);
        await userManager.ResetAccessFailedCountAsync(account);
        await userManager.SetLockoutEndDateAsync(account, null);

        return [];
    }
}
