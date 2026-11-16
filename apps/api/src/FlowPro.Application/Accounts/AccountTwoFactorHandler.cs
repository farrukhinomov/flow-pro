using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Two-step sign-in: a code from an authenticator app (RFC 6238), or a single-use recovery code,
/// after the password.
/// </summary>
/// <remarks>
/// <para>
/// A wrong code counts towards the same lockout as a wrong password. A correct password does not
/// reset that count for an account with two-step sign-in, so knowing the password does not give
/// unlimited guesses at the code.
/// </para>
/// <para>
/// Turning two-step sign-in on or off and creating new recovery codes ask for the current password,
/// and every change sends a notice, so a stolen session alone can neither weaken the sign-in
/// unnoticed nor lock the owner out.
/// </para>
/// </remarks>
public sealed class AccountTwoFactorHandler(
    IAccountCredentials credentials,
    IAccountTokenRepository tokens,
    IAccountSessionRepository sessions,
    IAccountRecoveryCodeRepository recoveryCodes,
    IAuthenticatorKeyProtector keyProtector,
    IAccountSecurityLog securityLog,
    CurrentPasswordCheck passwordCheck,
    SharedAccountPolicy sharedAccounts,
    AccountSessionIssuer issuer,
    AccountMailbox mailbox,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    ICommandHandler<CompleteTwoFactorSignInCommand, IssuedSession>,
    ICommandHandler<StartAuthenticatorSetupCommand, AuthenticatorSetup>,
    ICommandHandler<EnableTwoFactorCommand, TwoFactorEnabled>,
    ICommandHandler<DisableTwoFactorCommand, TwoFactorDisabled>,
    ICommandHandler<RegenerateRecoveryCodesCommand, RecoveryCodesIssued>
{
    /// <summary>The name authenticator apps show next to the code.</summary>
    public const string Issuer = "FlowPro";

    public const string ChallengeExpiredCode = "account.two_factor_challenge_expired";
    public const string CodeInvalidCode = "account.two_factor_code_invalid";
    public const string AlreadyEnabledCode = "account.two_factor_already_enabled";
    public const string NotEnabledCode = "account.two_factor_not_enabled";
    public const string SetupMissingCode = "account.two_factor_setup_missing";

    /// <summary>How long the browser has to enter the code after the password.</summary>
    public static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(5);

    private enum ChallengeResult
    {
        SignedIn,
        Expired,
        WrongCode,
    }

    public async Task<IssuedSession> HandleAsync(
        CompleteTwoFactorSignInCommand command,
        CancellationToken cancellationToken)
    {
        if (!SessionToken.LooksValid(command.ChallengeToken))
        {
            throw ChallengeExpired();
        }

        // A wrong code is counted and committed, so the rejection is raised after the transaction.
        (ChallengeResult result, IssuedSession? session, EmailMessage? notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                AccountToken? challenge = await tokens.FindByHashAsync(
                    SessionToken.Hash(command.ChallengeToken!),
                    transactionCancellationToken);

                if (challenge is null || !challenge.IsUsableFor(AccountTokenPurposes.TwoFactorSignIn, now))
                {
                    return (ChallengeResult.Expired, (IssuedSession?)null, (EmailMessage?)null);
                }

                Account? account = await credentials.FindByIdAsync(challenge.AccountId, transactionCancellationToken);

                if (account is null || !account.TwoFactorEnabled || account.IsLockedOut(now))
                {
                    challenge.Consume(now);
                    return (ChallengeResult.Expired, null, null);
                }

                CodeMatch match = await MatchAsync(account, command.Code, now, transactionCancellationToken);

                if (!match.Matched)
                {
                    bool lockedOut = await credentials.RecordFailedAttemptAsync(account, transactionCancellationToken);
                    Record(
                        lockedOut ? AccountSecurityEventTypes.LockedOut : AccountSecurityEventTypes.TwoFactorFailed,
                        account,
                        command.Client);

                    if (!lockedOut)
                    {
                        return (ChallengeResult.WrongCode, null, null);
                    }

                    // Locked out: this challenge is spent, and signing in again is refused until
                    // the lockout ends.
                    challenge.Consume(now);
                    return (ChallengeResult.Expired, null, null);
                }

                challenge.Consume(now);
                await credentials.ResetFailedAttemptsAsync(account, transactionCancellationToken);
                EmailMessage? message = null;

                if (match.RecoveryCodesLeft is { } left)
                {
                    Record(AccountSecurityEventTypes.RecoveryCodeUsed, account, command.Client);
                    message = AccountMailbox.RecoveryCodeUsedNotice(account, left);
                }

                Record(AccountSecurityEventTypes.SignedIn, account, command.Client);
                IssuedSession issued = await issuer.IssueAsync(
                    account,
                    command.Client,
                    null,
                    transactionCancellationToken);

                return (ChallengeResult.SignedIn, issued, message);
            },
            cancellationToken);

        switch (result)
        {
            case ChallengeResult.Expired:
                throw ChallengeExpired();
            case ChallengeResult.WrongCode:
                throw CodeInvalid();
        }

        mailbox.Send(notice);
        return session!;
    }

    public async Task<AuthenticatorSetup> HandleAsync(
        StartAuthenticatorSetupCommand command,
        CancellationToken cancellationToken)
    {
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);

        AuthenticatorSetup? setup = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (account.TwoFactorEnabled)
                {
                    throw new FlowProConflictException(AlreadyEnabledCode, "Two-step sign-in is already on.");
                }

                if (!await passwordCheck.CheckAsync(
                        account,
                        command.CurrentPassword,
                        command.Client,
                        transactionCancellationToken))
                {
                    return null;
                }

                // A new secret every time, so a QR code someone else saw earlier is worthless.
                byte[] key = Totp.GenerateKey();
                account.BeginAuthenticatorSetup(keyProtector.Protect(key));

                return new AuthenticatorSetup(
                    FormatKey(Base32.Encode(key)),
                    Totp.AuthenticatorUri(Issuer, account.Email, key));
            },
            cancellationToken);

        return setup ?? throw CurrentPasswordCheck.Incorrect();
    }

    public async Task<TwoFactorEnabled> HandleAsync(
        EnableTwoFactorCommand command,
        CancellationToken cancellationToken)
    {
        sharedAccounts.EnsureAccountCanChange(command.Caller.AccountId);

        (TwoFactorEnabled enabled, EmailMessage notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (account.TwoFactorEnabled)
                {
                    throw new FlowProConflictException(AlreadyEnabledCode, "Two-step sign-in is already on.");
                }

                if (account.AuthenticatorKey is null)
                {
                    throw new FlowProValidationException(
                        SetupMissingCode,
                        "Set up the authenticator app before turning two-step sign-in on.");
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                long step = Totp.Verify(keyProtector.Unprotect(account.AuthenticatorKey), command.Code, now)
                    ?? throw CodeInvalid();

                account.EnableTwoFactor(step);
                IReadOnlyList<string> codes = await ReplaceRecoveryCodesAsync(account, command.Client, now, transactionCancellationToken);

                // Those sessions signed in with the password alone.
                int ended = await sessions.RevokeAllAsync(
                    account.Id,
                    command.Caller.SessionId,
                    now,
                    transactionCancellationToken);
                Record(AccountSecurityEventTypes.TwoFactorEnabled, account, command.Client);

                return (new TwoFactorEnabled(codes, ended), AccountMailbox.TwoFactorEnabledNotice(account));
            },
            cancellationToken);

        mailbox.Send(notice);
        return enabled;
    }

    public async Task<TwoFactorDisabled> HandleAsync(
        DisableTwoFactorCommand command,
        CancellationToken cancellationToken)
    {
        (bool passwordAccepted, EmailMessage? notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (!account.TwoFactorEnabled)
                {
                    // An unfinished setup is simply dropped.
                    if (account.AuthenticatorKey is not null)
                    {
                        account.DisableTwoFactor();
                    }

                    return (true, (EmailMessage?)null);
                }

                if (!await passwordCheck.CheckAsync(
                        account,
                        command.CurrentPassword,
                        command.Client,
                        transactionCancellationToken))
                {
                    return (false, null);
                }

                account.DisableTwoFactor();
                await recoveryCodes.RemoveAllAsync(account.Id, transactionCancellationToken);
                Record(AccountSecurityEventTypes.TwoFactorDisabled, account, command.Client);

                return (true, AccountMailbox.TwoFactorDisabledNotice(account));
            },
            cancellationToken);

        if (!passwordAccepted)
        {
            throw CurrentPasswordCheck.Incorrect();
        }

        mailbox.Send(notice);
        return new TwoFactorDisabled();
    }

    public async Task<RecoveryCodesIssued> HandleAsync(
        RegenerateRecoveryCodesCommand command,
        CancellationToken cancellationToken)
    {
        (RecoveryCodesIssued? issued, EmailMessage? notice) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Account account = await RequireAccountAsync(command.Caller, transactionCancellationToken);

                if (!account.TwoFactorEnabled)
                {
                    throw new FlowProValidationException(
                        NotEnabledCode,
                        "Recovery codes only exist while two-step sign-in is on.");
                }

                if (!await passwordCheck.CheckAsync(
                        account,
                        command.CurrentPassword,
                        command.Client,
                        transactionCancellationToken))
                {
                    return ((RecoveryCodesIssued?)null, (EmailMessage?)null);
                }

                IReadOnlyList<string> codes = await ReplaceRecoveryCodesAsync(
                    account,
                    command.Client,
                    timeProvider.GetUtcNow(),
                    transactionCancellationToken);

                return (new RecoveryCodesIssued(codes), AccountMailbox.RecoveryCodesRegeneratedNotice(account));
            },
            cancellationToken);

        if (issued is null)
        {
            throw CurrentPasswordCheck.Incorrect();
        }

        mailbox.Send(notice);
        return issued;
    }

    /// <summary>
    /// Six digits are checked as an authenticator code, anything else as a recovery code.
    /// </summary>
    private async Task<CodeMatch> MatchAsync(
        Account account,
        string? code,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (Totp.Normalize(code) is not null)
        {
            long? step = Totp.Verify(keyProtector.Unprotect(account.AuthenticatorKey!), code, now);

            // A code already used for this step or a later one was seen before; it does not count.
            return step is { } matched && account.TryUseAuthenticatorTimeStep(matched)
                ? new CodeMatch(true, null)
                : CodeMatch.None;
        }

        if (RecoveryCodes.Normalize(code) is not { } normalized)
        {
            return CodeMatch.None;
        }

        string hash = RecoveryCodes.Hash(normalized);
        IReadOnlyList<AccountRecoveryCode> unused = await recoveryCodes.ListUnusedAsync(account.Id, cancellationToken);
        AccountRecoveryCode? found = unused.FirstOrDefault(
            candidate => string.Equals(candidate.CodeHash, hash, StringComparison.Ordinal));

        if (found is null)
        {
            return CodeMatch.None;
        }

        found.Use(now);
        return new CodeMatch(true, unused.Count - 1);
    }

    private async Task<IReadOnlyList<string>> ReplaceRecoveryCodesAsync(
        Account account,
        ClientContext client,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        await recoveryCodes.RemoveAllAsync(account.Id, cancellationToken);
        IReadOnlyList<string> codes = RecoveryCodes.Generate();

        foreach (string code in codes)
        {
            recoveryCodes.Add(new AccountRecoveryCode(
                account.Id,
                RecoveryCodes.Hash(RecoveryCodes.Normalize(code)!),
                now));
        }

        Record(AccountSecurityEventTypes.RecoveryCodesGenerated, account, client);
        return codes;
    }

    /// <summary>Groups of four, as apps that accept a typed key show it.</summary>
    private static string FormatKey(string key) =>
        string.Join(' ', key.Chunk(4).Select(group => new string(group)));

    private async Task<Account> RequireAccountAsync(AccountCaller caller, CancellationToken cancellationToken) =>
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

    private static FlowProValidationException ChallengeExpired() =>
        new(ChallengeExpiredCode, "The sign-in took too long. Sign in again.");

    private static FlowProValidationException CodeInvalid() =>
        new(CodeInvalidCode, "The code is incorrect.");

    /// <param name="RecoveryCodesLeft">Set when a recovery code was used: how many remain.</param>
    private sealed record CodeMatch(bool Matched, int? RecoveryCodesLeft)
    {
        public static CodeMatch None { get; } = new(false, null);
    }
}
