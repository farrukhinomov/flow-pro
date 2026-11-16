using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

/// <summary>
/// A visitor of the public demo must not be able to lock the other visitors out of a shared login.
/// </summary>
public sealed class SharedDemoLoginTests
{
    private const string Password = "a public demo password";

    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    public static TheoryData<string> Changes => ["password", "email", "two-step", "end-session", "end-others"];

    [Theory]
    [MemberData(nameof(Changes))]
    public async Task A_shared_demo_login_cannot_change_how_it_signs_in(string change)
    {
        Fixture fixture = new(TestSharedAccounts.Demo);
        AccountSession other = fixture.AddSession();
        string? passwordHashBefore = fixture.Account.PasswordHash;

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.ApplyAsync(change, other.Id));

        Assert.Equal(SharedAccountPolicy.SharedAccountCode, exception.Code);
        Assert.Equal(DemoWorkspace.Logins[0].Email, fixture.Account.Email);
        Assert.Equal(passwordHashBefore, fixture.Account.PasswordHash);
        Assert.Null(fixture.Account.AuthenticatorKey);
        Assert.Null(other.RevokedAt);
        Assert.Empty(fixture.Mail.Sent);
    }

    [Theory]
    [MemberData(nameof(Changes))]
    public async Task Without_the_demo_the_same_account_can_change(string change)
    {
        Fixture fixture = new(TestSharedAccounts.None);
        AccountSession other = fixture.AddSession();

        await fixture.ApplyAsync(change, other.Id);
    }

    [Fact]
    public async Task The_overview_tells_the_page_the_login_is_shared()
    {
        Fixture shared = new(TestSharedAccounts.Demo);
        Fixture ordinary = new(TestSharedAccounts.None);

        Assert.True((await shared.OverviewAsync()).IsSharedDemoLogin);
        Assert.False((await ordinary.OverviewAsync()).IsSharedDemoLogin);
    }

    [Fact]
    public void Only_the_demo_logins_are_shared_and_only_while_the_demo_runs()
    {
        Guid demoAccount = DemoWorkspace.Logins[1].AccountId;

        Assert.True(TestSharedAccounts.Demo.IsShared(demoAccount));
        Assert.False(TestSharedAccounts.Demo.IsShared(Guid.CreateVersion7()));
        Assert.False(TestSharedAccounts.Demo.IsShared(null));
        Assert.False(TestSharedAccounts.None.IsShared(demoAccount));
    }

    private sealed class Fixture
    {
        private int sessionCount;

        public Fixture(SharedAccountPolicy shared)
        {
            DemoLogin login = DemoWorkspace.Logins[0];
            Account = Credentials.Seed(login.Email, Password, login.DisplayName, login.AccountId);
            Store = new FakeSessionStore(Credentials);
            AccountSessionOptions options = new();
            AccountMailbox mailbox = new(
                Store,
                Mail,
                new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test/") },
                Time);
            CurrentPasswordCheck passwordCheck = new(Credentials, Store, Time);
            PassThroughUnitOfWork unitOfWork = new();
            Security = new AccountSecurityHandler(
                Credentials, Store, Store, RecoveryCodes, passwordCheck, shared, mailbox, unitOfWork, options, Time);
            TwoFactor = new AccountTwoFactorHandler(
                Credentials,
                Store,
                Store,
                RecoveryCodes,
                new FakeKeyProtector(),
                Store,
                passwordCheck,
                shared,
                new AccountSessionIssuer(Store, Store, options, Time),
                mailbox,
                unitOfWork,
                Time);
            Session = AddSession();
        }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeRecoveryCodes RecoveryCodes { get; } = new();

        public FakeEmailQueue Mail { get; } = new();

        public Account Account { get; }

        public AccountSession Session { get; }

        public AccountCaller Caller => new(Account.Id, Session.Id);

        public AccountSecurityHandler Security { get; }

        public AccountTwoFactorHandler TwoFactor { get; }

        public Task ApplyAsync(string change, Guid otherSessionId) => change switch
        {
            "password" => Security.HandleAsync(
                new ChangePasswordCommand(Caller, Password, "another long passphrase", Client),
                CancellationToken.None),
            "email" => Security.HandleAsync(
                new ChangeEmailCommand(Caller, Password, "visitor@example.com", Client),
                CancellationToken.None),
            "two-step" => TwoFactor.HandleAsync(
                new StartAuthenticatorSetupCommand(Caller, Password, Client),
                CancellationToken.None),
            "end-session" => Security.HandleAsync(
                new RevokeSessionCommand(Caller, otherSessionId, Client),
                CancellationToken.None),
            "end-others" => Security.HandleAsync(
                new RevokeOtherSessionsCommand(Caller, Client),
                CancellationToken.None),
            _ => throw new ArgumentOutOfRangeException(nameof(change)),
        };

        public Task<AccountOverview> OverviewAsync() =>
            Security.HandleAsync(new GetAccountOverviewQuery(Caller), CancellationToken.None);

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
    }
}
