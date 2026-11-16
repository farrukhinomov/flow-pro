using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Asks a signed-in person for their password again before a sensitive change, so a stolen session
/// alone is not enough to take over the account.
/// </summary>
/// <remarks>
/// The check counts towards lockout like a sign-in, so a stolen session cannot be used to guess the
/// password. A failure is recorded and must be committed, so callers raise
/// <see cref="Incorrect" /> after their transaction.
/// </remarks>
public sealed class CurrentPasswordCheck(
    IAccountCredentials credentials,
    IAccountSecurityLog securityLog,
    TimeProvider timeProvider)
{
    public const string IncorrectCode = "account.current_password_incorrect";

    public async Task<bool> CheckAsync(
        Account account,
        string? password,
        ClientContext client,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(account);
        ArgumentNullException.ThrowIfNull(client);

        PasswordCheck check = await credentials.CheckPasswordAsync(
            account.Email,
            password ?? string.Empty,
            cancellationToken);

        if (check.Outcome == PasswordCheckOutcome.Succeeded && check.Account is not null)
        {
            // The person is already signed in, two-step included, so the attempt is complete.
            await credentials.ResetFailedAttemptsAsync(account, cancellationToken);
            return true;
        }

        securityLog.Record(new AccountSecurityEvent(
            check.CausedLockout ? AccountSecurityEventTypes.LockedOut : AccountSecurityEventTypes.SignInFailed,
            account.Id,
            account.Email,
            client.IpAddress,
            client.UserAgent,
            timeProvider.GetUtcNow()));
        return false;
    }

    public static FlowProValidationException Incorrect() =>
        new(IncorrectCode, "The current password is incorrect.");
}
