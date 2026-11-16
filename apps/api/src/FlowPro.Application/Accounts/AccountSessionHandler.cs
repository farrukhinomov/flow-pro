using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Registration, sign-in, sign-out and session lookup for accounts.
/// </summary>
/// <remarks>
/// Failure messages are deliberately the same for an unknown email, a wrong password and a locked
/// account, so the API does not reveal which emails have accounts.
/// </remarks>
public sealed class AccountSessionHandler(
    IAccountCredentials credentials,
    IAccountSessionRepository sessions,
    IAccountTokenRepository tokens,
    IAccountSecurityLog securityLog,
    AccountSessionIssuer issuer,
    AccountMailbox mailbox,
    IUnitOfWork unitOfWork,
    AccountSessionOptions options,
    TimeProvider timeProvider) :
    ICommandHandler<RegisterAccountCommand, IssuedSession>,
    ICommandHandler<SignInCommand, SignInOutcome>,
    ICommandHandler<SignOutCommand, SignedOut>,
    IQueryHandler<ResolveSessionQuery, ResolvedSession?>
{
    public const string InvalidCredentialsCode = "authentication.invalid_credentials";

    public async Task<IssuedSession> HandleAsync(
        RegisterAccountCommand command,
        CancellationToken cancellationToken)
    {
        if (!options.RegistrationEnabled)
        {
            throw new FlowProForbiddenException(
                "account.registration_disabled",
                "Registration is turned off on this instance.");
        }

        (IssuedSession session, EmailMessage? confirmation) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                AccountRegistration registration = await credentials.RegisterAsync(
                    command.Email,
                    command.DisplayName,
                    command.Password,
                    transactionCancellationToken);

                if (registration.Account is null)
                {
                    throw ToException(registration);
                }

                Record(AccountSecurityEventTypes.Registered, registration.Account, command.Client);
                EmailMessage? message = await mailbox.PrepareAsync(
                    registration.Account,
                    AccountTokenPurposes.EmailVerification,
                    transactionCancellationToken);

                return (
                    await issuer.IssueAsync(registration.Account, command.Client, null, transactionCancellationToken),
                    message);
            },
            cancellationToken);

        mailbox.Send(confirmation);
        return session;
    }

    public async Task<SignInOutcome> HandleAsync(
        SignInCommand command,
        CancellationToken cancellationToken)
    {
        // A failed attempt has to be saved (failure counter, lockout, security event) even though
        // the request is then rejected, so the rejection is raised after the transaction commits.
        SignInOutcome? outcome = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                PasswordCheck check = await credentials.CheckPasswordAsync(
                    command.Email,
                    command.Password,
                    transactionCancellationToken);

                if (check.Outcome == PasswordCheckOutcome.Succeeded && check.Account is not null)
                {
                    // The failure count stays until the code is right too, so knowing the
                    // password does not buy unlimited guesses at the code.
                    if (check.Account.TwoFactorEnabled)
                    {
                        return SignInOutcome.CodeRequired(IssueChallenge(check.Account));
                    }

                    await credentials.ResetFailedAttemptsAsync(check.Account, transactionCancellationToken);
                    Record(AccountSecurityEventTypes.SignedIn, check.Account, command.Client);
                    return SignInOutcome.SignedIn(
                        await issuer.IssueAsync(check.Account, command.Client, null, transactionCancellationToken));
                }

                Record(
                    check.CausedLockout
                        ? AccountSecurityEventTypes.LockedOut
                        : AccountSecurityEventTypes.SignInFailed,
                    check.Account,
                    command.Client,
                    command.Email);
                return null;
            },
            cancellationToken);

        return outcome ?? throw new FlowProAuthenticationFailedException(
            InvalidCredentialsCode,
            "The email or password is incorrect.");
    }

    public Task<SignedOut> HandleAsync(SignOutCommand command, CancellationToken cancellationToken)
    {
        if (!SessionToken.LooksValid(command.SessionToken))
        {
            return Task.FromResult(new SignedOut(false));
        }

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                AccountSession? session = await sessions.FindByTokenHashAsync(
                    SessionToken.Hash(command.SessionToken!),
                    transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();

                if (session is null || !session.IsActive(now, options.IdleTimeout))
                {
                    return new SignedOut(false);
                }

                session.Revoke(now);
                securityLog.Record(new AccountSecurityEvent(
                    AccountSecurityEventTypes.SignedOut,
                    session.AccountId,
                    email: null,
                    command.Client.IpAddress,
                    command.Client.UserAgent,
                    now));
                return new SignedOut(true);
            },
            cancellationToken);
    }

    public Task<ResolvedSession?> HandleAsync(
        ResolveSessionQuery query,
        CancellationToken cancellationToken)
    {
        if (!SessionToken.LooksValid(query.SessionToken))
        {
            return Task.FromResult<ResolvedSession?>(null);
        }

        return unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                AccountSession? session = await sessions.FindByTokenHashAsync(
                    SessionToken.Hash(query.SessionToken!),
                    transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();

                if (session is null || !session.IsActive(now, options.IdleTimeout))
                {
                    return null;
                }

                Account? account = await sessions.FindAccountAsync(
                    session.AccountId,
                    transactionCancellationToken);

                if (account is null || account.IsLockedOut(now))
                {
                    return null;
                }

                session.Touch(now, options.ActivityWriteInterval);

                return new ResolvedSession(
                    session.Id,
                    account.Id,
                    account.Email,
                    account.DisplayName,
                    session.ActiveTenantId);
            },
            cancellationToken);
    }

    private IssuedChallenge IssueChallenge(Account account)
    {
        string token = SessionToken.Generate();
        AccountToken challenge = new(
            account.Id,
            AccountTokenPurposes.TwoFactorSignIn,
            SessionToken.Hash(token),
            timeProvider.GetUtcNow(),
            AccountTwoFactorHandler.ChallengeLifetime);
        tokens.Add(challenge);

        return new IssuedChallenge(token, challenge.ExpiresAt);
    }

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

    internal static FlowProApplicationException ToException(AccountRegistration registration)
    {
        string detail = registration.Problems.Count > 0
            ? string.Join(' ', registration.Problems)
            : "The account could not be created.";

        return registration.Outcome switch
        {
            AccountRegistrationOutcome.EmailAlreadyRegistered => new FlowProConflictException(
                "account.email_already_registered",
                "An account with this email already exists."),
            AccountRegistrationOutcome.PasswordRejected => new FlowProValidationException(
                "account.password_rejected",
                detail),
            _ => new FlowProValidationException("account.email_rejected", detail),
        };
    }
}
