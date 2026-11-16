using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountSessionHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task Register_creates_a_session_and_stores_only_the_token_hash()
    {
        Fixture fixture = new();

        IssuedSession issued = await fixture.Handler.HandleAsync(
            new RegisterAccountCommand("Ada@Example.com", "correct horse battery", "Ada", Client),
            CancellationToken.None);

        AccountSession stored = Assert.Single(fixture.Sessions.Sessions);
        Assert.Equal("ada@example.com", issued.Email);
        Assert.True(SessionToken.LooksValid(issued.Token));
        Assert.Equal(SessionToken.Hash(issued.Token), stored.TokenHash);
        Assert.NotEqual(issued.Token, stored.TokenHash);
        Assert.Equal(Now + fixture.Options.AbsoluteLifetime, issued.ExpiresAt);
        Assert.Equal(
            AccountSecurityEventTypes.Registered,
            Assert.Single(fixture.Sessions.Events).Type);
    }

    [Fact]
    public async Task Register_sends_a_confirmation_link_that_carries_no_stored_secret()
    {
        Fixture fixture = new();

        await fixture.Handler.HandleAsync(
            new RegisterAccountCommand("ada@example.com", "correct horse battery", "Ada", Client),
            CancellationToken.None);

        EmailMessage message = Assert.Single(fixture.Mail.Sent);
        AccountToken token = Assert.Single(fixture.Sessions.Tokens);
        Assert.Equal("ada@example.com", message.To);
        Assert.Contains("https://flowpro.test/verify-email#token=", message.TextBody, StringComparison.Ordinal);
        Assert.Equal(AccountTokenPurposes.EmailVerification, token.Purpose);
        Assert.Equal(SessionToken.Hash(fixture.Mail.LastToken()), token.TokenHash);
    }

    [Fact]
    public async Task Register_reports_a_duplicate_email_as_a_conflict()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(
                new RegisterAccountCommand("ada@example.com", "another long password", "Ada", Client),
                CancellationToken.None));

        Assert.Equal("account.email_already_registered", exception.Code);
        Assert.Empty(fixture.Sessions.Sessions);
    }

    [Fact]
    public async Task Register_is_refused_when_registration_is_turned_off()
    {
        Fixture fixture = new(new AccountSessionOptions { RegistrationEnabled = false });

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new RegisterAccountCommand("ada@example.com", "correct horse battery", "Ada", Client),
                CancellationToken.None));

        Assert.Equal("account.registration_disabled", exception.Code);
        Assert.Empty(fixture.Sessions.Sessions);
    }

    [Fact]
    public async Task Register_reports_a_rejected_password_as_a_validation_error()
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new RegisterAccountCommand("ada@example.com", "short", "Ada", Client),
                CancellationToken.None));

        Assert.Equal("account.password_rejected", exception.Code);
    }

    [Fact]
    public async Task Sign_in_with_the_right_password_issues_a_session()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed("ada@example.com", "correct horse battery");

        SignInOutcome outcome = await fixture.Handler.HandleAsync(
            new SignInCommand("ada@example.com", "correct horse battery", Client),
            CancellationToken.None);

        Assert.Null(outcome.Challenge);
        Assert.Equal(account.Id, outcome.Session!.AccountId);
        AccountSession stored = Assert.Single(fixture.Sessions.Sessions);
        Assert.Equal("203.0.113.7", stored.IpAddress);
        Assert.Equal("TestBrowser/1.0", stored.UserAgent);
        Assert.Equal(AccountSecurityEventTypes.SignedIn, Assert.Single(fixture.Sessions.Events).Type);
    }

    [Theory]
    [InlineData("ada@example.com", "wrong password here")]
    [InlineData("nobody@example.com", "correct horse battery")]
    public async Task Sign_in_failures_share_one_error_and_are_recorded(string email, string password)
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");

        FlowProAuthenticationFailedException exception =
            await Assert.ThrowsAsync<FlowProAuthenticationFailedException>(
                () => fixture.Handler.HandleAsync(
                    new SignInCommand(email, password, Client),
                    CancellationToken.None));

        Assert.Equal(AccountSessionHandler.InvalidCredentialsCode, exception.Code);
        Assert.Empty(fixture.Sessions.Sessions);
        AccountSecurityEvent recorded = Assert.Single(fixture.Sessions.Events);
        Assert.Equal(AccountSecurityEventTypes.SignInFailed, recorded.Type);
        Assert.Equal(email, recorded.Email);
    }

    [Fact]
    public async Task Sign_in_to_a_locked_account_fails_like_a_wrong_password()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        fixture.Credentials.LockedOut.Add("ada@example.com");

        FlowProAuthenticationFailedException exception =
            await Assert.ThrowsAsync<FlowProAuthenticationFailedException>(
                () => fixture.Handler.HandleAsync(
                    new SignInCommand("ada@example.com", "correct horse battery", Client),
                    CancellationToken.None));

        Assert.Equal(AccountSessionHandler.InvalidCredentialsCode, exception.Code);
        Assert.Empty(fixture.Sessions.Sessions);
    }

    [Fact]
    public async Task The_attempt_that_locks_an_account_is_recorded_as_a_lockout()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        fixture.Credentials.NextFailureCausesLockout = true;

        await Assert.ThrowsAsync<FlowProAuthenticationFailedException>(
            () => fixture.Handler.HandleAsync(
                new SignInCommand("ada@example.com", "wrong password here", Client),
                CancellationToken.None));

        Assert.Equal(AccountSecurityEventTypes.LockedOut, Assert.Single(fixture.Sessions.Events).Type);
    }

    [Fact]
    public async Task A_valid_token_resolves_to_its_account()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        IssuedSession issued = await fixture.SignInAsync();

        ResolvedSession? resolved = await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(issued.Token),
            CancellationToken.None);

        Assert.NotNull(resolved);
        Assert.Equal(account.Id, resolved.AccountId);
        Assert.Equal("ada@example.com", resolved.Email);
        Assert.Null(resolved.ActiveTenantId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-token")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task An_unknown_or_malformed_token_resolves_to_nothing(string? token)
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        await fixture.SignInAsync();

        ResolvedSession? resolved = await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(token),
            CancellationToken.None);

        Assert.Null(resolved);
    }

    [Fact]
    public async Task A_session_stops_resolving_after_the_idle_timeout()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        IssuedSession issued = await fixture.SignInAsync();

        fixture.Time.Advance(fixture.Options.IdleTimeout + TimeSpan.FromSeconds(1));

        Assert.Null(await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(issued.Token),
            CancellationToken.None));
    }

    [Fact]
    public async Task Activity_keeps_a_session_alive_until_its_absolute_expiry()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        IssuedSession issued = await fixture.SignInAsync();
        TimeSpan step = fixture.Options.IdleTimeout - TimeSpan.FromHours(1);

        DateTimeOffset lastUse = Now;
        while (lastUse + step < issued.ExpiresAt)
        {
            fixture.Time.Advance(step);
            lastUse += step;
            Assert.NotNull(await fixture.Handler.HandleAsync(
                new ResolveSessionQuery(issued.Token),
                CancellationToken.None));
        }

        fixture.Time.Advance(step);

        Assert.Null(await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(issued.Token),
            CancellationToken.None));
    }

    [Fact]
    public async Task A_session_of_a_locked_account_stops_resolving()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        IssuedSession issued = await fixture.SignInAsync();

        account.SetLockoutEnd(Now.AddMinutes(15));

        Assert.Null(await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(issued.Token),
            CancellationToken.None));
    }

    [Fact]
    public async Task Sign_out_revokes_the_session()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed("ada@example.com", "correct horse battery");
        IssuedSession issued = await fixture.SignInAsync();

        SignedOut result = await fixture.Handler.HandleAsync(
            new SignOutCommand(issued.Token, Client),
            CancellationToken.None);

        Assert.True(result.SessionEnded);
        Assert.Null(await fixture.Handler.HandleAsync(
            new ResolveSessionQuery(issued.Token),
            CancellationToken.None));
        Assert.Contains(
            fixture.Sessions.Events,
            securityEvent => securityEvent.Type == AccountSecurityEventTypes.SignedOut);
    }

    [Fact]
    public async Task Sign_out_without_a_session_succeeds_quietly()
    {
        Fixture fixture = new();

        SignedOut result = await fixture.Handler.HandleAsync(
            new SignOutCommand(null, Client),
            CancellationToken.None);

        Assert.False(result.SessionEnded);
        Assert.Empty(fixture.Sessions.Events);
    }

    private sealed class Fixture
    {
        public Fixture(AccountSessionOptions? options = null)
        {
            Options = options ?? new AccountSessionOptions();
            Sessions = new FakeSessionStore(Credentials);
            Handler = new AccountSessionHandler(
                Credentials,
                Sessions,
                Sessions,
                Sessions,
                new AccountSessionIssuer(Sessions, Sessions, Options, Time),
                new AccountMailbox(
                    Sessions,
                    Mail,
                    new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test/") },
                    Time),
                new PassThroughUnitOfWork(),
                Options,
                Time);
        }

        public AccountSessionOptions Options { get; }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Sessions { get; }

        public FakeEmailQueue Mail { get; } = new();

        public AccountSessionHandler Handler { get; }

        public async Task<IssuedSession> SignInAsync() =>
            (await Handler.HandleAsync(
                new SignInCommand("ada@example.com", "correct horse battery", Client),
                CancellationToken.None)).Session!;
    }
}
