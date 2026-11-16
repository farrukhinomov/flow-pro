using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountSecurityHandlerTests
{
    private const string Email = "ada@example.com";
    private const string Password = "correct horse battery";
    private const string NewPassword = "a brand new passphrase";

    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task The_overview_lists_active_sessions_and_marks_the_current_one()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession other = fixture.AddSession();
        fixture.AddSession().Revoke(Now);
        fixture.AddSession(otherAccount: true);

        AccountOverview overview = await fixture.Handler.HandleAsync(
            new GetAccountOverviewQuery(Fixture.CallerFor(current)),
            CancellationToken.None);

        Assert.Equal(Email, overview.Email);
        Assert.False(overview.EmailConfirmed);
        Assert.Equal(
            new HashSet<Guid> { current.Id, other.Id },
            overview.Sessions.Select(session => session.SessionId).ToHashSet());
        Assert.True(overview.Sessions.Single(session => session.SessionId == current.Id).IsCurrent);
        Assert.False(overview.Sessions.Single(session => session.SessionId == other.Id).IsCurrent);
    }

    [Fact]
    public async Task Idle_sessions_are_left_out_of_the_overview()
    {
        Fixture fixture = new();
        AccountSession idle = fixture.AddSession();
        fixture.Time.Advance(fixture.Options.IdleTimeout);
        AccountSession current = fixture.AddSession();

        AccountOverview overview = await fixture.Handler.HandleAsync(
            new GetAccountOverviewQuery(Fixture.CallerFor(current)),
            CancellationToken.None);

        Assert.DoesNotContain(overview.Sessions, session => session.SessionId == idle.Id);
    }

    [Fact]
    public async Task Changing_the_password_keeps_this_session_ends_the_others_and_notifies_the_owner()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession other = fixture.AddSession();

        PasswordChanged result = await fixture.Handler.HandleAsync(
            new ChangePasswordCommand(Fixture.CallerFor(current), Password, NewPassword, Client),
            CancellationToken.None);

        Assert.Equal(1, result.OtherSessionsEnded);
        Assert.Null(current.RevokedAt);
        Assert.NotNull(other.RevokedAt);
        Assert.Equal(NewPassword, fixture.Credentials.PasswordOf(Email));
        EmailMessage notice = Assert.Single(fixture.Mail.Sent);
        Assert.Equal(Email, notice.To);
        Assert.DoesNotContain("token", notice.TextBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.PasswordChanged);
    }

    [Fact]
    public async Task A_wrong_current_password_changes_nothing_and_is_recorded()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession other = fixture.AddSession();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new ChangePasswordCommand(Fixture.CallerFor(current), "wrong password!", NewPassword, Client),
                CancellationToken.None));

        Assert.Equal(AccountSecurityHandler.CurrentPasswordIncorrectCode, exception.Code);
        Assert.Equal(Password, fixture.Credentials.PasswordOf(Email));
        Assert.Null(other.RevokedAt);
        Assert.Empty(fixture.Mail.Sent);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.SignInFailed);
    }

    [Fact]
    public async Task A_rejected_new_password_changes_nothing()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new ChangePasswordCommand(Fixture.CallerFor(current), Password, "short", Client),
                CancellationToken.None));

        Assert.Equal("account.password_rejected", exception.Code);
        Assert.Equal(Password, fixture.Credentials.PasswordOf(Email));
        Assert.Empty(fixture.Mail.Sent);
    }

    [Fact]
    public async Task Another_session_of_the_account_can_be_revoked()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession other = fixture.AddSession();

        SessionsRevoked result = await fixture.Handler.HandleAsync(
            new RevokeSessionCommand(Fixture.CallerFor(current), other.Id, Client),
            CancellationToken.None);

        Assert.Equal(1, result.Count);
        Assert.NotNull(other.RevokedAt);
        Assert.Null(current.RevokedAt);
    }

    [Fact]
    public async Task A_session_of_another_account_looks_like_it_does_not_exist()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession foreign = fixture.AddSession(otherAccount: true);

        FlowProNotFoundException exception = await Assert.ThrowsAsync<FlowProNotFoundException>(
            () => fixture.Handler.HandleAsync(
                new RevokeSessionCommand(Fixture.CallerFor(current), foreign.Id, Client),
                CancellationToken.None));

        Assert.Equal("account.session_not_found", exception.Code);
        Assert.Null(foreign.RevokedAt);
    }

    [Fact]
    public async Task The_current_session_is_ended_by_signing_out_not_by_revoking()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new RevokeSessionCommand(Fixture.CallerFor(current), current.Id, Client),
                CancellationToken.None));

        Assert.Equal("account.session_current", exception.Code);
        Assert.Null(current.RevokedAt);
    }

    [Fact]
    public async Task Signing_out_everywhere_else_keeps_only_this_session()
    {
        Fixture fixture = new();
        AccountSession current = fixture.AddSession();
        AccountSession first = fixture.AddSession();
        AccountSession second = fixture.AddSession();
        AccountSession foreign = fixture.AddSession(otherAccount: true);

        SessionsRevoked result = await fixture.Handler.HandleAsync(
            new RevokeOtherSessionsCommand(Fixture.CallerFor(current), Client),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Null(current.RevokedAt);
        Assert.NotNull(first.RevokedAt);
        Assert.NotNull(second.RevokedAt);
        Assert.Null(foreign.RevokedAt);
    }

    private sealed class Fixture
    {
        private int sessionCount;

        public Fixture(SharedAccountPolicy? shared = null)
        {
            Shared = shared ?? TestSharedAccounts.None;
            Account = Credentials.Seed(Email, Password);
            OtherAccount = Credentials.Seed("grace@example.com", Password);
            Store = new FakeSessionStore(Credentials);
            Handler = new AccountSecurityHandler(
                Credentials,
                Store,
                Store,
                new FakeRecoveryCodes(),
                new CurrentPasswordCheck(Credentials, Store, Time),
                Shared,
                new AccountMailbox(
                    Store,
                    Mail,
                    new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test") },
                    Time),
                new PassThroughUnitOfWork(),
                Options,
                Time);
        }

        public SharedAccountPolicy Shared { get; }

        public AccountSessionOptions Options { get; } = new();

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeEmailQueue Mail { get; } = new();

        public Account Account { get; }

        public Account OtherAccount { get; }

        public AccountSecurityHandler Handler { get; }

        public AccountSession AddSession(bool otherAccount = false)
        {
            sessionCount++;
            AccountSession session = new(
                otherAccount ? OtherAccount.Id : Account.Id,
                sessionCount.ToString("x64", System.Globalization.CultureInfo.InvariantCulture),
                Time.GetUtcNow(),
                TimeSpan.FromDays(30),
                "TestBrowser/1.0",
                "203.0.113.7");
            Store.Add(session);
            return session;
        }

        public static AccountCaller CallerFor(AccountSession session) => new(session.AccountId, session.Id);
    }
}
