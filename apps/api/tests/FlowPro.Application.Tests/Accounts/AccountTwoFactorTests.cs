using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountTwoFactorTests
{
    private const string Email = "ada@example.com";
    private const string Password = "correct horse battery";

    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task Setup_needs_the_current_password()
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.TwoFactor.HandleAsync(
                new StartAuthenticatorSetupCommand(fixture.Caller, "wrong password", Client),
                CancellationToken.None));

        Assert.Equal(CurrentPasswordCheck.IncorrectCode, exception.Code);
        Assert.Null(fixture.Account.AuthenticatorKey);
        Assert.Equal(1, fixture.Account.AccessFailedCount);
    }

    [Fact]
    public async Task Setup_stores_the_secret_encrypted_and_leaves_two_step_sign_in_off()
    {
        Fixture fixture = new();

        AuthenticatorSetup setup = await fixture.StartSetupAsync();

        Assert.False(fixture.Account.TwoFactorEnabled);
        Assert.StartsWith("protected:", fixture.Account.AuthenticatorKey, StringComparison.Ordinal);
        Assert.Matches("^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$", setup.SharedKey);
        Assert.StartsWith("otpauth://totp/FlowPro:ada%40example.com?secret=", setup.AuthenticatorUri, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Turning_it_on_needs_a_code_from_the_app()
    {
        Fixture fixture = new();
        await fixture.StartSetupAsync();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.TwoFactor.HandleAsync(
                new EnableTwoFactorCommand(fixture.Caller, "000000", Client),
                CancellationToken.None));

        Assert.Equal(AccountTwoFactorHandler.CodeInvalidCode, exception.Code);
        Assert.False(fixture.Account.TwoFactorEnabled);
    }

    [Fact]
    public async Task Turning_it_on_issues_recovery_codes_and_signs_out_other_sessions()
    {
        Fixture fixture = new();
        AccountSession other = fixture.AddSession();

        TwoFactorEnabled enabled = await fixture.EnableWithCodesAsync();

        Assert.True(fixture.Account.TwoFactorEnabled);
        Assert.Equal(RecoveryCodes.Count, enabled.RecoveryCodes.Count);
        Assert.Equal(1, enabled.OtherSessionsEnded);
        Assert.NotNull(other.RevokedAt);
        Assert.Null(fixture.Session.RevokedAt);

        // Only hashes are stored.
        Assert.Equal(
            enabled.RecoveryCodes.Select(code => RecoveryCodes.Hash(RecoveryCodes.Normalize(code)!)).Order(StringComparer.Ordinal),
            fixture.RecoveryCodes.Codes.Select(code => code.CodeHash).Order(StringComparer.Ordinal));
        Assert.Equal("Two-step sign-in is on for your FlowPro account", fixture.Mail.Sent[^1].Subject);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.TwoFactorEnabled);
    }

    [Fact]
    public async Task With_two_step_sign_in_the_password_alone_gives_a_challenge_not_a_session()
    {
        Fixture fixture = new();
        await fixture.EnableAsync();
        int sessionsBefore = fixture.Store.Sessions.Count;

        SignInOutcome outcome = await fixture.SignInAsync();

        Assert.Null(outcome.Session);
        Assert.NotNull(outcome.Challenge);
        Assert.Equal(Now + AccountTwoFactorHandler.ChallengeLifetime, outcome.Challenge.ExpiresAt);
        Assert.Equal(sessionsBefore, fixture.Store.Sessions.Count);
    }

    [Fact]
    public async Task The_code_from_the_app_completes_the_sign_in_once()
    {
        Fixture fixture = new();
        byte[] key = await fixture.EnableAsync(advanceAfter: true);
        string code = fixture.CurrentCode(key);

        IssuedSession session = await fixture.CompleteAsync((await fixture.SignInAsync()).Challenge!.Token, code);

        Assert.Equal(fixture.Account.Id, session.AccountId);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.SignedIn);

        // Someone who saw that code cannot use it again, even with a fresh challenge.
        string next = (await fixture.SignInAsync()).Challenge!.Token;
        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(next, code));
        Assert.Equal(AccountTwoFactorHandler.CodeInvalidCode, exception.Code);
    }

    [Fact]
    public async Task A_challenge_works_once()
    {
        Fixture fixture = new();
        byte[] key = await fixture.EnableAsync(advanceAfter: true);
        string challenge = (await fixture.SignInAsync()).Challenge!.Token;
        await fixture.CompleteAsync(challenge, fixture.CurrentCode(key));
        fixture.Time.Advance(TimeSpan.FromSeconds(30));

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(challenge, fixture.CurrentCode(key)));

        Assert.Equal(AccountTwoFactorHandler.ChallengeExpiredCode, exception.Code);
    }

    [Fact]
    public async Task A_challenge_expires_after_a_few_minutes()
    {
        Fixture fixture = new();
        byte[] key = await fixture.EnableAsync(advanceAfter: true);
        string challenge = (await fixture.SignInAsync()).Challenge!.Token;
        fixture.Time.Advance(AccountTwoFactorHandler.ChallengeLifetime + TimeSpan.FromSeconds(1));

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(challenge, fixture.CurrentCode(key)));

        Assert.Equal(AccountTwoFactorHandler.ChallengeExpiredCode, exception.Code);
    }

    [Fact]
    public async Task A_token_issued_for_something_else_is_not_a_challenge()
    {
        Fixture fixture = new();
        byte[] key = await fixture.EnableAsync(advanceAfter: true);
        fixture.Mailbox.Send(await fixture.Mailbox.PrepareAsync(
            fixture.Account,
            AccountTokenPurposes.PasswordReset,
            CancellationToken.None));

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(fixture.Mail.LastToken(), fixture.CurrentCode(key)));

        Assert.Equal(AccountTwoFactorHandler.ChallengeExpiredCode, exception.Code);
    }

    [Fact]
    public async Task Entering_the_password_again_does_not_reset_the_count_of_wrong_codes()
    {
        Fixture fixture = new();
        await fixture.EnableAsync(advanceAfter: true);

        string challenge = (await fixture.SignInAsync()).Challenge!.Token;

        for (int attempt = 0; attempt < 4; attempt++)
        {
            await Assert.ThrowsAsync<FlowProValidationException>(() => fixture.CompleteAsync(challenge, "000000"));
        }

        // A correct password again, then one more wrong code: that is the fifth, and it locks.
        challenge = (await fixture.SignInAsync()).Challenge!.Token;
        FlowProValidationException locked = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(challenge, "000000"));

        Assert.Equal(AccountTwoFactorHandler.ChallengeExpiredCode, locked.Code);
        Assert.True(fixture.Account.IsLockedOut(fixture.Time.GetUtcNow()));
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.LockedOut);
        await Assert.ThrowsAsync<FlowProAuthenticationFailedException>(() => fixture.SignInAsync());
    }

    [Fact]
    public async Task The_right_code_resets_the_count_of_wrong_ones()
    {
        Fixture fixture = new();
        byte[] key = await fixture.EnableAsync(advanceAfter: true);
        string challenge = (await fixture.SignInAsync()).Challenge!.Token;
        await Assert.ThrowsAsync<FlowProValidationException>(() => fixture.CompleteAsync(challenge, "000000"));
        Assert.Equal(1, fixture.Account.AccessFailedCount);

        await fixture.CompleteAsync(challenge, fixture.CurrentCode(key));

        Assert.Equal(0, fixture.Account.AccessFailedCount);
    }

    [Fact]
    public async Task A_recovery_code_signs_in_once_and_the_owner_is_told()
    {
        Fixture fixture = new();
        TwoFactorEnabled enabled = await fixture.EnableWithCodesAsync();
        string recoveryCode = enabled.RecoveryCodes[3];

        IssuedSession session = await fixture.CompleteAsync(
            (await fixture.SignInAsync()).Challenge!.Token,
            recoveryCode.ToUpperInvariant());

        Assert.Equal(fixture.Account.Id, session.AccountId);
        Assert.Equal(RecoveryCodes.Count - 1, fixture.RecoveryCodes.Codes.Count(code => !code.IsUsed));
        Assert.Equal("A FlowPro recovery code was used to sign in", fixture.Mail.Sent[^1].Subject);
        Assert.Contains("9 recovery codes left", fixture.Mail.Sent[^1].TextBody, StringComparison.Ordinal);

        string next = (await fixture.SignInAsync()).Challenge!.Token;
        await Assert.ThrowsAsync<FlowProValidationException>(() => fixture.CompleteAsync(next, recoveryCode));
    }

    [Fact]
    public async Task New_recovery_codes_replace_the_old_ones()
    {
        Fixture fixture = new();
        TwoFactorEnabled enabled = await fixture.EnableWithCodesAsync();

        RecoveryCodesIssued issued = await fixture.TwoFactor.HandleAsync(
            new RegenerateRecoveryCodesCommand(fixture.Caller, Password, Client),
            CancellationToken.None);

        Assert.Equal(RecoveryCodes.Count, fixture.RecoveryCodes.Codes.Count);
        string challenge = (await fixture.SignInAsync()).Challenge!.Token;
        await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.CompleteAsync(challenge, enabled.RecoveryCodes[0]));
        await fixture.CompleteAsync((await fixture.SignInAsync()).Challenge!.Token, issued.RecoveryCodes[0]);
    }

    [Fact]
    public async Task Turning_it_off_needs_the_password_and_removes_the_codes()
    {
        Fixture fixture = new();
        await fixture.EnableAsync();

        await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.TwoFactor.HandleAsync(
                new DisableTwoFactorCommand(fixture.Caller, "wrong password", Client),
                CancellationToken.None));
        Assert.True(fixture.Account.TwoFactorEnabled);

        await fixture.TwoFactor.HandleAsync(
            new DisableTwoFactorCommand(fixture.Caller, Password, Client),
            CancellationToken.None);

        Assert.False(fixture.Account.TwoFactorEnabled);
        Assert.Null(fixture.Account.AuthenticatorKey);
        Assert.Empty(fixture.RecoveryCodes.Codes);
        Assert.Equal("Two-step sign-in is off for your FlowPro account", fixture.Mail.Sent[^1].Subject);
        Assert.NotNull((await fixture.SignInAsync()).Session);
    }

    [Fact]
    public async Task The_overview_shows_the_status_and_codes_left()
    {
        Fixture fixture = new();
        await fixture.EnableAsync();

        AccountOverview overview = await fixture.Security.HandleAsync(
            new GetAccountOverviewQuery(fixture.Caller),
            CancellationToken.None);

        Assert.True(overview.TwoFactorEnabled);
        Assert.Equal(RecoveryCodes.Count, overview.RecoveryCodesLeft);
    }

    private sealed class Fixture
    {
        private int sessionCount;

        public Fixture()
        {
            Account = Credentials.Seed(Email, Password);
            Store = new FakeSessionStore(Credentials);
            AccountSessionOptions options = new();
            AccountSessionIssuer issuer = new(Store, Store, options, Time);
            Mailbox = new AccountMailbox(
                Store,
                Mail,
                new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test/") },
                Time);
            CurrentPasswordCheck passwordCheck = new(Credentials, Store, Time);
            PassThroughUnitOfWork unitOfWork = new();

            Sessions = new AccountSessionHandler(
                Credentials, Store, Store, Store, issuer, Mailbox, unitOfWork, options, Time);
            TwoFactor = new AccountTwoFactorHandler(
                Credentials,
                Store,
                Store,
                RecoveryCodes,
                new FakeKeyProtector(),
                Store,
                passwordCheck,
                TestSharedAccounts.None,
                issuer,
                Mailbox,
                unitOfWork,
                Time);
            Security = new AccountSecurityHandler(
                Credentials, Store, Store, RecoveryCodes, passwordCheck, TestSharedAccounts.None, Mailbox, unitOfWork, options, Time);
            Session = AddSession();
        }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeRecoveryCodes RecoveryCodes { get; } = new();

        public FakeEmailQueue Mail { get; } = new();

        public AccountMailbox Mailbox { get; }

        public Account Account { get; }

        public AccountSession Session { get; }

        public AccountCaller Caller => new(Account.Id, Session.Id);

        public AccountSessionHandler Sessions { get; }

        public AccountTwoFactorHandler TwoFactor { get; }

        public AccountSecurityHandler Security { get; }

        public Task<AuthenticatorSetup> StartSetupAsync() =>
            TwoFactor.HandleAsync(
                new StartAuthenticatorSetupCommand(Caller, Password, Client),
                CancellationToken.None);

        /// <summary>
        /// Sets up and turns on two-step sign-in and returns the secret. With
        /// <paramref name="advanceAfter" />, the clock moves on to the next code, since the one that
        /// turned it on cannot be used again.
        /// </summary>
        public async Task<byte[]> EnableAsync(bool advanceAfter = false)
        {
            (byte[] key, _) = await EnableCoreAsync();

            if (advanceAfter)
            {
                Time.Advance(TimeSpan.FromSeconds(Totp.PeriodSeconds));
            }

            return key;
        }

        public async Task<TwoFactorEnabled> EnableWithCodesAsync() => (await EnableCoreAsync()).Enabled;

        public string CurrentCode(byte[] key) => Totp.Compute(key, Totp.TimeStep(Time.GetUtcNow()));

        public Task<SignInOutcome> SignInAsync() =>
            Sessions.HandleAsync(new SignInCommand(Email, Password, Client), CancellationToken.None);

        public Task<IssuedSession> CompleteAsync(string challenge, string code) =>
            TwoFactor.HandleAsync(
                new CompleteTwoFactorSignInCommand(challenge, code, Client),
                CancellationToken.None);

        public AccountSession AddSession()
        {
            sessionCount++;
            AccountSession session = new(
                Account.Id,
                sessionCount.ToString("x64", System.Globalization.CultureInfo.InvariantCulture),
                Time.GetUtcNow(),
                TimeSpan.FromDays(30),
                "TestBrowser/1.0",
                "203.0.113.7");
            Store.Add(session);
            return session;
        }

        private async Task<(byte[] Key, TwoFactorEnabled Enabled)> EnableCoreAsync()
        {
            AuthenticatorSetup setup = await StartSetupAsync();
            byte[] key = Base32.Decode(setup.SharedKey);
            TwoFactorEnabled enabled = await TwoFactor.HandleAsync(
                new EnableTwoFactorCommand(Caller, CurrentCode(key), Client),
                CancellationToken.None);

            return (key, enabled);
        }
    }
}
