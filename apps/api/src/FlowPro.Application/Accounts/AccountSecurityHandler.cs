using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// What a signed-in person can see and change about their own account: its sessions, its
/// password and its email address.
/// </summary>
/// <remarks>
/// Every command acts only on the caller's own account. A session identifier that belongs to
/// another account is answered like one that does not exist.
/// </remarks>
public sealed class AccountSecurityHandler(
    IAccountCredentials credentials,
    IAccountSessionRepository sessions,
    IAccountSecurityLog securityLog,
    IAccountRecoveryCodeRepository recoveryCodes,
    CurrentPasswordCheck passwordCheck,
    SharedAccountPolicy sharedAccounts,
    AccountMailbox mailbox,
    IUnitOfWork unitOfWork,
    AccountSessionOptions options,
    TimeProvider timeProvider) :
    IQueryHandler<GetAccountOverviewQuery, AccountOverview>,
    ICommandHandler<ChangePasswordCommand, PasswordChanged>,
    ICommandHandler<ChangeEmailCommand, EmailRequestAccepted>,
    ICommandHandler<RevokeSessionCommand, SessionsRevoked>,
    ICommandHandler<RevokeOtherSessionsCommand, SessionsRevoked>
{
    public const string CurrentPasswordIncorrectCode = CurrentPasswordCheck.IncorrectCode;
    public const string EmailInvalidCode = "account.email_invalid";
    public const string EmailUnchangedCode = "account.email_unchanged";

    public async Task<AccountOverview> HandleAsync(
        GetAccountOverviewQuery query,
        CancellationToken cancellationToken)
    {
        Account account = await RequireAccountAsync(query.Caller, cancellationToken);
        DateTimeOffset now = timeProvider.GetUtcNow();
        IReadOnlyList<AccountSession> active = await sessions.ListActiveAsync(
            account.Id,
            now,
            cancellationToken);
        int recoveryCodesLeft = account.TwoFactorEnabled
            ? (await recoveryCodes.ListUnusedAsync(account.Id, cancellationToken)).Count
            : 0;

        return new AccountOverview(
            account.Id,
            account.Email,
            account.DisplayName,
            account.EmailConfirmed,
            [
                .. active
                    .Where(session => session.IsActive(now, options.IdleTimeout))
                    .Select(session => new AccountSessionSummary(
                        session.Id,
                        session.CreatedAt,
                        session.LastSeenAt,
                        session.ExpiresAt,
                        session.UserAgent,
                        session.IpAddress,
                        session.Id == query.Caller.SessionId)),
            ],
            account.TwoFactorEnabled,
            recoveryCodesLeft,
            sharedAccounts.IsShared(account.Id));
    }

    public async Task<PasswordChanged> HandleAsync(
        ChangePasswordCommand command,
        CancellationToken cancellationToken)
    {
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);

        // A wrong current password still commits its count towards lockout, so the rejection is
        // raised after the transaction.
        (PasswordChanged? result, EmailMessage? notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (!await passwordCheck.CheckAsync(
                        account,
                        command.CurrentPassword,
                        command.Client,
                        transactionCancellationToken))
                {
                    return ((PasswordChanged?)null, (EmailMessage?)null);
                }

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

                int ended = await sessions.RevokeAllAsync(
                    account.Id,
                    command.Caller.SessionId,
                    timeProvider.GetUtcNow(),
                    transactionCancellationToken);
                Record(AccountSecurityEventTypes.PasswordChanged, account, command.Client);

                return (new PasswordChanged(ended), AccountMailbox.PasswordChangedNotice(account));
            },
            cancellationToken);

        if (result is null)
        {
            throw CurrentPasswordIncorrect();
        }

        mailbox.Send(notice);
        return result;
    }

    public async Task<EmailRequestAccepted> HandleAsync(
        ChangeEmailCommand command,
        CancellationToken cancellationToken)
    {
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);
        string newEmail = RequireEmailAddress(command.NewEmail);

        // Like a password change, the current password is checked and counts towards lockout, so
        // a stolen session alone cannot move the account to the thief's mailbox. The answer is the
        // same whether or not the new address already has an account; only that mailbox learns it.
        (bool passwordAccepted, EmailMessage? message) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (string.Equals(account.Email, newEmail, StringComparison.Ordinal))
                {
                    throw new FlowProValidationException(
                        EmailUnchangedCode,
                        "This is already your email address.");
                }

                if (!await passwordCheck.CheckAsync(
                        account,
                        command.CurrentPassword,
                        command.Client,
                        transactionCancellationToken))
                {
                    return (false, (EmailMessage?)null);
                }

                Record(AccountSecurityEventTypes.EmailChangeRequested, account, command.Client);
                Account? holder = await credentials.FindByEmailAsync(newEmail, transactionCancellationToken);

                return (true, holder is null
                    ? await mailbox.PrepareEmailChangeAsync(account, newEmail, transactionCancellationToken)
                    : AccountMailbox.EmailInUseNotice(newEmail));
            },
            cancellationToken);

        if (!passwordAccepted)
        {
            throw CurrentPasswordIncorrect();
        }

        mailbox.Send(message);
        return new EmailRequestAccepted();
    }

    public Task<SessionsRevoked> HandleAsync(
        RevokeSessionCommand command,
        CancellationToken cancellationToken)
    {
        // Other visitors of a shared demo login would be signed out.
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);

        if (command.SessionId == command.Caller.SessionId)
        {
            throw new FlowProValidationException(
                "account.session_current",
                "Sign out to end the session you are using.");
        }

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                AccountSession? session = await sessions.FindByIdAsync(
                    command.SessionId,
                    transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();

                if (session is null || session.AccountId != command.Caller.AccountId)
                {
                    throw new FlowProNotFoundException(
                        "account.session_not_found",
                        "That session does not exist.");
                }

                if (session.RevokedAt is not null)
                {
                    return new SessionsRevoked(0);
                }

                session.Revoke(now);
                RecordForAccount(AccountSecurityEventTypes.SessionRevoked, command.Caller.AccountId, command.Client);
                return new SessionsRevoked(1);
            },
            cancellationToken);
    }

    public Task<SessionsRevoked> HandleAsync(
        RevokeOtherSessionsCommand command,
        CancellationToken cancellationToken)
    {
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                int ended = await sessions.RevokeAllAsync(
                    command.Caller.AccountId,
                    command.Caller.SessionId,
                    timeProvider.GetUtcNow(),
                    transactionCancellationToken);

                if (ended > 0)
                {
                    RecordForAccount(AccountSecurityEventTypes.SessionRevoked, command.Caller.AccountId, command.Client);
                }

                return new SessionsRevoked(ended);
            },
            cancellationToken);
    }

    private static FlowProValidationException CurrentPasswordIncorrect() => CurrentPasswordCheck.Incorrect();

    private static string RequireEmailAddress(string? email)
    {
        string trimmed = email?.Trim() ?? string.Empty;

        // MailAddress also accepts "Name <a@b>"; only a bare address that round-trips is valid.
        if (trimmed.Length is 0 or > 320
            || !System.Net.Mail.MailAddress.TryCreate(trimmed, out System.Net.Mail.MailAddress? parsed)
            || !string.Equals(parsed.Address, trimmed, StringComparison.OrdinalIgnoreCase))
        {
            throw new FlowProValidationException(EmailInvalidCode, "Enter a valid email address.");
        }

        return Account.NormalizeEmail(trimmed);
    }

    private async Task<Account> RequireAccountAsync(
        AccountCaller caller,
        CancellationToken cancellationToken) =>
        await credentials.FindByIdAsync(caller.AccountId, cancellationToken)
        ?? throw new FlowProUnauthorizedException();

    private void Record(string type, Account account, ClientContext client) =>
        securityLog.Record(new AccountSecurityEvent(
            type,
            account.Id,
            account.Email,
            client.IpAddress,
            client.UserAgent,
            timeProvider.GetUtcNow()));

    private void RecordForAccount(string type, Guid accountId, ClientContext client) =>
        securityLog.Record(new AccountSecurityEvent(
            type,
            accountId,
            email: null,
            client.IpAddress,
            client.UserAgent,
            timeProvider.GetUtcNow()));
}
