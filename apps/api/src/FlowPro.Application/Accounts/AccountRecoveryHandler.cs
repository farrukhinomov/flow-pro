using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Email confirmation, password reset and email change: the account flows that prove control of
/// a mailbox.
/// </summary>
/// <remarks>
/// Asking for a reset link answers the same way for every email, so the endpoint cannot be used
/// to find out who has an account. A link is single-use, expires, and stops working as soon as a
/// newer one is sent.
/// </remarks>
public sealed class AccountRecoveryHandler(
    IAccountCredentials credentials,
    IAccountTokenRepository tokens,
    IAccountSessionRepository sessions,
    IAccountSecurityLog securityLog,
    IAccountMemberships memberships,
    AccountMailbox mailbox,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    ICommandHandler<RequestPasswordResetCommand, EmailRequestAccepted>,
    ICommandHandler<ResetPasswordCommand, PasswordResetCompleted>,
    ICommandHandler<VerifyEmailCommand, EmailVerificationCompleted>,
    ICommandHandler<ResendEmailVerificationCommand, EmailRequestAccepted>,
    ICommandHandler<ConfirmEmailChangeCommand, EmailChangeCompleted>
{
    public const string InvalidTokenCode = "account.token_invalid";
    public const string EmailTakenCode = "account.email_taken";

    public async Task<EmailRequestAccepted> HandleAsync(
        RequestPasswordResetCommand command,
        CancellationToken cancellationToken)
    {
        EmailMessage? message = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account? account = await credentials.FindByEmailAsync(
                    command.Email,
                    transactionCancellationToken);
                Record(
                    AccountSecurityEventTypes.PasswordResetRequested,
                    account,
                    command.Client,
                    command.Email);

                return account is null
                    ? null
                    : await mailbox.PrepareAsync(
                        account,
                        AccountTokenPurposes.PasswordReset,
                        transactionCancellationToken);
            },
            cancellationToken);

        mailbox.Send(message);
        return new EmailRequestAccepted();
    }

    public Task<PasswordResetCompleted> HandleAsync(
        ResetPasswordCommand command,
        CancellationToken cancellationToken)
    {
        RequireWellFormed(command.Token);

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                (AccountToken token, Account account) = await RedeemAsync(
                    command.Token,
                    AccountTokenPurposes.PasswordReset,
                    transactionCancellationToken);

                // A rejected password throws before the token is consumed, so the person can
                // try again with the same link.
                IReadOnlyList<string> problems = await credentials.ResetPasswordAsync(
                    account,
                    command.NewPassword ?? string.Empty,
                    transactionCancellationToken);

                if (problems.Count > 0)
                {
                    throw new FlowProValidationException(
                        "account.password_rejected",
                        string.Join(' ', problems));
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                token.Consume(now);

                // Following the link proved the person reads this mailbox.
                if (!account.EmailConfirmed)
                {
                    account.SetEmailConfirmed(true);
                }

                int ended = await sessions.RevokeAllAsync(
                    account.Id,
                    exceptSessionId: null,
                    now,
                    transactionCancellationToken);
                Record(AccountSecurityEventTypes.PasswordReset, account, command.Client);

                return new PasswordResetCompleted(ended);
            },
            cancellationToken);
    }

    public Task<EmailVerificationCompleted> HandleAsync(
        VerifyEmailCommand command,
        CancellationToken cancellationToken)
    {
        RequireWellFormed(command.Token);

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                (AccountToken token, Account account) = await RedeemAsync(
                    command.Token,
                    AccountTokenPurposes.EmailVerification,
                    transactionCancellationToken);

                token.Consume(timeProvider.GetUtcNow());

                if (!account.EmailConfirmed)
                {
                    account.SetEmailConfirmed(true);
                    Record(AccountSecurityEventTypes.EmailVerified, account, command.Client);
                }

                return new EmailVerificationCompleted(account.Email);
            },
            cancellationToken);
    }

    public async Task<EmailRequestAccepted> HandleAsync(
        ResendEmailVerificationCommand command,
        CancellationToken cancellationToken)
    {
        EmailMessage? message = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account? account = await credentials.FindByIdAsync(
                    command.AccountId,
                    transactionCancellationToken);

                if (account is null || account.EmailConfirmed)
                {
                    return null;
                }

                Record(AccountSecurityEventTypes.EmailVerificationSent, account, command.Client);
                return await mailbox.PrepareAsync(
                    account,
                    AccountTokenPurposes.EmailVerification,
                    transactionCancellationToken);
            },
            cancellationToken);

        mailbox.Send(message);
        return new EmailRequestAccepted();
    }

    public async Task<EmailChangeCompleted> HandleAsync(
        ConfirmEmailChangeCommand command,
        CancellationToken cancellationToken)
    {
        RequireWellFormed(command.Token);

        (EmailChangeCompleted result, EmailMessage notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                (AccountToken token, Account account) = await RedeemAsync(
                    command.Token,
                    AccountTokenPurposes.EmailChange,
                    transactionCancellationToken);
                string newEmail = token.NewEmail ?? throw InvalidToken();

                // Someone may have registered the address since the link was sent.
                Account? holder = await credentials.FindByEmailAsync(newEmail, transactionCancellationToken);

                if (holder is not null && holder.Id != account.Id)
                {
                    throw new FlowProValidationException(
                        EmailTakenCode,
                        "This email address now belongs to another account.");
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                string oldEmail = account.Email;

                // Links already sent to the old address must not keep working for it.
                await tokens.ConsumeOutstandingAsync(account.Id, purpose: null, now, transactionCancellationToken);
                token.Consume(now);

                account.ChangeEmail(newEmail);
                account.SetEmailConfirmed(true);
                account.SetSecurityStamp(Guid.NewGuid().ToString("N"));
                await memberships.MoveEmailAsync(account.Id, oldEmail, newEmail, transactionCancellationToken);
                Record(AccountSecurityEventTypes.EmailChanged, account, command.Client);

                return (
                    new EmailChangeCompleted(account.Email),
                    AccountMailbox.EmailChangedNotice(account, oldEmail));
            },
            cancellationToken);

        mailbox.Send(notice);
        return result;
    }

    private async Task<(AccountToken Token, Account Account)> RedeemAsync(
        string rawToken,
        string purpose,
        CancellationToken cancellationToken)
    {
        AccountToken? token = await tokens.FindByHashAsync(
            SessionToken.Hash(rawToken),
            cancellationToken);

        if (token is null || !token.IsUsableFor(purpose, timeProvider.GetUtcNow()))
        {
            throw InvalidToken();
        }

        Account account = await credentials.FindByIdAsync(token.AccountId, cancellationToken)
            ?? throw InvalidToken();

        return (token, account);
    }

    private static void RequireWellFormed(string? token)
    {
        if (!SessionToken.LooksValid(token))
        {
            throw InvalidToken();
        }
    }

    private static FlowProValidationException InvalidToken() =>
        new(InvalidTokenCode, "This link is invalid or has expired. Ask for a new one.");

    private void Record(
        string type,
        Account? account,
        ClientContext client,
        string? attemptedEmail = null) =>
        securityLog.Record(new AccountSecurityEvent(
            type,
            account?.Id,
            account?.Email ?? attemptedEmail,
            client.IpAddress,
            client.UserAgent,
            timeProvider.GetUtcNow()));
}
